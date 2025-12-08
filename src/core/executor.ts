import type { Account, Address, Hex } from 'viem'
import { decodeFunctionData, encodeFunctionData, getAddress } from 'viem'

import * as constants from '../constants'
import {
  SafeOperation,
  type SafeOperationValue,
  erc4626Abi,
  p2pSuperformProxyAbi,
  p2pSuperformProxyFactoryAbi,
  rolesModuleAbi,
  superformRouterSingleWithdrawAbi
} from '../utils/abis'
import { buildDepositBody, fetchDepositStart } from '../utils/deposit'
import {
  buildProxyBatchClaimCalldata,
  decodeRewardsDistributorBatchClaim,
  fetchProtocolRewardsClaim as fetchProtocolRewardsClaimFromApi
} from '../utils/rewards'
import type {
  BatchClaimParams,
  DepositParams,
  ExecutorConfig,
  PredictProxyAddressParams,
  RolesExecutionParams,
  WithdrawAccruedRewardsParams,
  WithdrawParams
} from './types'

export class P2pSafeSuperformExecutor {
  private static readonly ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  private readonly walletClient: ExecutorConfig['walletClient']
  private readonly publicClient: ExecutorConfig['publicClient']
  private readonly config: Required<
    Pick<ExecutorConfig, 'p2pSuperformProxyFactoryAddress' | 'validateRolesTarget'>
  > &
    ExecutorConfig
  private readonly log: (message: string) => void
  private readonly fetcher: typeof fetch

  constructor(config: ExecutorConfig) {
    this.walletClient = config.walletClient
    this.publicClient = config.publicClient
    this.config = {
      ...config,
      p2pSuperformProxyFactoryAddress:
        config.p2pSuperformProxyFactoryAddress ?? constants.P2P_SUPERFORM_PROXY_FACTORY_ADDRESS,
      p2pModuleAddress:
        config.p2pModuleAddress ??
        config.walletClient.account?.address ?? constants.P2P_ADDRESS,
      defaultRoleKey: config.defaultRoleKey ?? constants.DEFAULT_ROLE_KEY,
      validateRolesTarget: config.validateRolesTarget ?? true,
      superformApiKey: config.superformApiKey ?? process.env.SF_API_KEY
    }
    this.log = config.logger ?? ((message: string) => console.info(message))
    this.fetcher = config.fetcher ?? fetch
  }

  async deposit(params: DepositParams): Promise<Hex> {
    const chainId = this.walletClient.chain?.id
    if (!chainId) {
      throw new Error('walletClient.chain.id is required for deposit')
    }
    const apiKey = this.config.superformApiKey
    if (!apiKey) {
      throw new Error('superformApiKey (or SF_API_KEY in env) is required for deposit')
    }

    const proxyAddress = await this.predictProxyAddress({
      client: params.safeAddress,
      clientBasisPointsOfDeposit: params.clientBasisPointsOfDeposit,
      clientBasisPointsOfProfit: params.clientBasisPointsOfProfit
    })

    const body = buildDepositBody({
      userAddress: proxyAddress,
      fromTokenAddress: params.fromTokenAddress,
      fromChainId: chainId,
      amountIn: params.amountIn,
      refundAddress: proxyAddress,
      vaultId: params.vaultId,
      bridgeSlippage: params.bridgeSlippage,
      swapSlippage: params.swapSlippage,
      routeType: params.routeType,
      excludeAmbs: params.excludeAmbs,
      excludeLiquidityProviders: params.excludeLiquidityProviders,
      excludeDexes: params.excludeDexes,
      excludeBridges: params.excludeBridges
    })

    const depositStart = await fetchDepositStart({
      apiKey,
      body,
      fetcher: this.fetcher
    })

    const depositData = encodeFunctionData({
      abi: p2pSuperformProxyFactoryAbi,
      functionName: 'deposit',
      args: [
        depositStart.data,
        this.normalizeUint48(params.clientBasisPointsOfDeposit, 'clientBasisPointsOfDeposit'),
        this.normalizeUint48(params.clientBasisPointsOfProfit, 'clientBasisPointsOfProfit'),
        this.normalizeBigInt(params.p2pSignerSigDeadline, 'p2pSignerSigDeadline'),
        params.p2pSignerSignature
      ]
    })

    this.log(
      `➡️  Deposit via Roles ${params.rolesAddress} -> Safe ${params.safeAddress} -> Factory ${this.config.p2pSuperformProxyFactoryAddress}`
    )

    return this.executeViaRoles({
      rolesAddress: params.rolesAddress,
      target: this.config.p2pSuperformProxyFactoryAddress,
      data: depositData,
      value: this.normalizeBigInt(
        params.value ?? (depositStart.value ? BigInt(depositStart.value) : undefined),
        'value',
        0n
      ),
      roleKey: params.roleKey,
      shouldRevertOnFailure: params.shouldRevertOnFailure,
      operation: params.operation,
      expectedSafe: params.safeAddress
    })
  }

  async withdraw(params: WithdrawParams): Promise<Hex> {
    const withdrawData = encodeFunctionData({
      abi: p2pSuperformProxyAbi,
      functionName: 'withdraw',
      args: [params.superformCalldata]
    })

    this.log(
      `➡️  Withdraw via Roles ${params.rolesAddress} -> Safe ${params.safeAddress} -> Proxy ${params.p2pSuperformProxyAddress}`
    )

    return this.executeViaRoles({
      rolesAddress: params.rolesAddress,
      target: params.p2pSuperformProxyAddress,
      data: withdrawData,
      value: this.normalizeBigInt(params.value, 'value', 0n),
      roleKey: params.roleKey,
      shouldRevertOnFailure: params.shouldRevertOnFailure,
      operation: params.operation,
      expectedSafe: params.safeAddress
    })
  }

  async withdrawAccruedRewards(params: WithdrawAccruedRewardsParams): Promise<Hex> {
    const parsed = this.decodeSingleDirectSingleVaultWithdraw(params.superformCalldata)
    const { superformId, amount, liqRequest } = parsed.superformData
    const asset = await this.resolveAssetForWithdraw(superformId, liqRequest.token)

    const accruedRewards = (await this.publicClient.readContract({
      address: params.p2pSuperformProxyAddress,
      abi: p2pSuperformProxyAbi,
      functionName: 'calculateAccruedRewards',
      args: [superformId, asset]
    })) as bigint

    if (accruedRewards <= 0n) {
      throw new Error(
        `No accrued rewards available for superformId=${superformId.toString()} asset=${asset}; got ${accruedRewards.toString()}`
      )
    }

    const accruedRewardsPositive = BigInt(accruedRewards)
    if (amount !== accruedRewardsPositive) {
      throw new Error(
        `superformCalldata amount (${amount}) must equal accrued rewards (${accruedRewardsPositive})`
      )
    }

    const withdrawData = encodeFunctionData({
      abi: p2pSuperformProxyAbi,
      functionName: 'withdrawAccruedRewards',
      args: [params.superformCalldata]
    })

    this.log(
      `➡️  Withdraw accrued rewards via Roles ${params.rolesAddress} -> Safe ${params.safeAddress} -> Proxy ${params.p2pSuperformProxyAddress}`
    )

    return this.executeViaRoles({
      rolesAddress: params.rolesAddress,
      target: params.p2pSuperformProxyAddress,
      data: withdrawData,
      value: this.normalizeBigInt(params.value, 'value', 0n),
      roleKey: params.roleKey,
      shouldRevertOnFailure: params.shouldRevertOnFailure,
      operation: params.operation,
      expectedSafe: params.safeAddress
    })
  }

  async batchClaim(params: BatchClaimParams): Promise<Hex> {
    const claim = await this.fetchProtocolRewardsClaim(params.p2pSuperformProxyAddress)
    const decoded = decodeRewardsDistributorBatchClaim(claim.transactionData)

    const expectedProxy = getAddress(params.p2pSuperformProxyAddress)
    if (decoded.receiver !== expectedProxy) {
      throw new Error(
        `Claim receiver ${decoded.receiver} does not match proxy ${expectedProxy} from params`
      )
    }

    const { data } = buildProxyBatchClaimCalldata(decoded)

    this.log(
      `➡️  Batch claim via Roles ${params.rolesAddress} -> Safe ${params.safeAddress} -> Proxy ${params.p2pSuperformProxyAddress}`
    )

    return this.executeViaRoles({
      rolesAddress: params.rolesAddress,
      target: params.p2pSuperformProxyAddress,
      data,
      value: this.normalizeBigInt(params.value, 'value', 0n),
      roleKey: params.roleKey,
      shouldRevertOnFailure: params.shouldRevertOnFailure,
      operation: params.operation,
      expectedSafe: params.safeAddress
    })
  }

  async predictProxyAddress(params: PredictProxyAddressParams): Promise<Address> {
    const address = (await this.publicClient.readContract({
      address: params.factoryAddress ?? this.config.p2pSuperformProxyFactoryAddress,
      abi: p2pSuperformProxyFactoryAbi,
      functionName: 'predictP2pYieldProxyAddress',
      args: [
        params.client,
        this.normalizeUint48(params.clientBasisPointsOfDeposit, 'clientBasisPointsOfDeposit'),
        this.normalizeUint48(params.clientBasisPointsOfProfit, 'clientBasisPointsOfProfit')
      ]
    })) as Address

    return address
  }

  private async executeViaRoles(params: RolesExecutionParams): Promise<Hex> {
    const account = this.requireAccount()
    await this.assertRolesTarget(params.rolesAddress, params.expectedSafe)

    const roleKey = this.resolveRoleKey(params.roleKey)
    const value = this.normalizeBigInt(params.value, 'value', 0n)
    const operation: SafeOperationValue = params.operation ?? SafeOperation.Call
    const shouldRevert = params.shouldRevertOnFailure ?? true

    this.log(
      `➡️  Roles execution -> target ${params.target} value=${value.toString()} operation=${operation} role=${roleKey}`
    )

    const txHash = await this.walletClient.writeContract({
      address: params.rolesAddress,
      abi: rolesModuleAbi,
      functionName: 'execTransactionWithRole',
      args: [params.target, value, params.data, operation, roleKey, shouldRevert],
      account,
      chain: this.walletClient.chain
    })

    this.log(`⏳ Waiting for Roles tx ${txHash}`)
    await this.publicClient.waitForTransactionReceipt({ hash: txHash })
    this.log(`✅ Roles tx confirmed ${txHash}`)

    return txHash
  }

  private resolveRoleKey(custom?: Hex): Hex {
    if (custom) {
      return custom
    }
    if (this.config.defaultRoleKey) {
      return this.config.defaultRoleKey
    }
    throw new Error('Role key is required for Roles execution')
  }

  private normalizeUint48(value: bigint | number, label: string): number {
    try {
      const asBigInt = BigInt(value)
      if (asBigInt < 0n || asBigInt > (1n << 48n) - 1n) {
        throw new Error(`value ${asBigInt.toString()} is outside uint48 range`)
      }
      return Number(asBigInt)
    } catch (error) {
      throw new Error(`${label} must fit in uint48: ${(error as Error).message}`)
    }
  }

  private normalizeBigInt(
    value: bigint | number | undefined,
    label: string,
    defaultValue: bigint = 0n
  ): bigint {
    if (value === undefined) {
      return defaultValue
    }
    try {
      return BigInt(value)
    } catch (error) {
      throw new Error(`${label} must be a number or bigint: ${(error as Error).message}`)
    }
  }

  private requireAccount(): Account {
    const account = this.walletClient.account
    if (!account) {
      throw new Error('Wallet client must have an active account')
    }
    this.ensureModuleAccount(account)
    return account
  }

  private ensureModuleAccount(account: Account) {
    if (!this.config.p2pModuleAddress) {
      return
    }
    const expected = getAddress(this.config.p2pModuleAddress)
    const actual = getAddress(account.address)
    if (expected !== actual) {
      throw new Error(
        `Wallet client account ${actual} does not match configured P2P module ${expected}`
      )
    }
  }

  private async assertRolesTarget(rolesAddress: Address, safeAddress?: Address) {
    if (!this.config.validateRolesTarget || !safeAddress) {
      return
    }
    const normalizedSafe = getAddress(safeAddress)
    try {
      const [avatar, target] = await Promise.all([
        this.publicClient.readContract({
          address: rolesAddress,
          abi: rolesModuleAbi,
          functionName: 'avatar'
        }),
        this.publicClient.readContract({
          address: rolesAddress,
          abi: rolesModuleAbi,
          functionName: 'target'
        })
      ])

      const avatarAddress = getAddress(avatar as Address)
      const targetAddress = getAddress(target as Address)

      if (avatarAddress !== normalizedSafe || targetAddress !== normalizedSafe) {
        throw new Error(
          `Roles module ${rolesAddress} is wired to avatar=${avatarAddress} target=${targetAddress}, expected ${normalizedSafe}`
        )
      }
    } catch (error) {
      throw new Error(
        `Failed to verify Roles wiring for ${rolesAddress}: ${(error as Error).message}`
      )
    }
  }

  private decodeSingleDirectSingleVaultWithdraw(data: Hex) {
    const decoded = decodeFunctionData({
      abi: superformRouterSingleWithdrawAbi,
      data
    })

    if (decoded.functionName !== 'singleDirectSingleVaultWithdraw') {
      throw new Error('superformCalldata selector must be singleDirectSingleVaultWithdraw')
    }

    // decoded.args[0] is the req_ struct
    return decoded.args[0] as {
      superformData: {
        superformId: bigint
        amount: bigint
        outputAmount: bigint
        maxSlippage: bigint
        liqRequest: {
          txData: Hex
          token: Address
          interimToken: Address
          bridgeId: number
          liqDstChainId: bigint
          nativeAmount: bigint
        }
        permit2data: Hex
        hasDstSwap: boolean
        retain4626: boolean
        receiverAddress: Address
        receiverAddressSP: Address
        extraFormData: Hex
      }
    }
  }

  private async resolveAssetForWithdraw(superformId: bigint, liqRequestToken: Address): Promise<Address> {
    if (getAddress(liqRequestToken) !== P2pSafeSuperformExecutor.ZERO_ADDRESS) {
      return getAddress(liqRequestToken)
    }

    const superformAsAddress = this.superformIdToAddress(superformId)
    const asset = await this.publicClient.readContract({
      address: superformAsAddress,
      abi: erc4626Abi,
      functionName: 'asset'
    })

    return getAddress(asset as Address)
  }

  private superformIdToAddress(superformId: bigint): Address {
    const hex = superformId.toString(16).padStart(40, '0')
    return getAddress(`0x${hex}`)
  }

  private async fetchProtocolRewardsClaim(user: Address) {
    const chainId = this.walletClient.chain?.id
    if (!chainId) {
      throw new Error('walletClient.chain.id is required to fetch rewards claim data')
    }
    const apiKey = this.config.superformApiKey
    if (!apiKey) {
      throw new Error('superformApiKey (or SF_API_KEY in env) is required to fetch rewards claim data')
    }

    return fetchProtocolRewardsClaimFromApi({
      chainId,
      user,
      apiKey
    })
  }
}
