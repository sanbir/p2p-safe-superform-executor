import type { Account, Address, Hex } from 'viem'
import { encodeFunctionData, getAddress } from 'viem'

import * as constants from '../constants'
import {
  SafeOperation,
  type SafeOperationValue,
  p2pSuperformProxyAbi,
  p2pSuperformProxyFactoryAbi,
  rolesModuleAbi
} from '../utils/abis'
import type {
  DepositParams,
  ExecutorConfig,
  PredictProxyAddressParams,
  RolesExecutionParams,
  WithdrawParams
} from './types'

export class P2pSafeSuperformExecutor {
  private readonly walletClient: ExecutorConfig['walletClient']
  private readonly publicClient: ExecutorConfig['publicClient']
  private readonly config: Required<
    Pick<ExecutorConfig, 'p2pSuperformProxyFactoryAddress' | 'validateRolesTarget'>
  > &
    ExecutorConfig
  private readonly log: (message: string) => void

  constructor(config: ExecutorConfig) {
    this.walletClient = config.walletClient
    this.publicClient = config.publicClient
    this.config = {
      ...config,
      p2pSuperformProxyFactoryAddress:
        config.p2pSuperformProxyFactoryAddress ?? constants.P2P_SUPERFORM_PROXY_FACTORY_ADDRESS,
      p2pModuleAddress:
        config.p2pModuleAddress ??
        config.walletClient.account?.address ??
        constants.P2P_ADDRESS,
      defaultRoleKey: config.defaultRoleKey ?? constants.DEFAULT_ROLE_KEY,
      validateRolesTarget: config.validateRolesTarget ?? true
    }
    this.log = config.logger ?? ((message: string) => console.info(message))
  }

  async deposit(params: DepositParams): Promise<Hex> {
    const depositData = encodeFunctionData({
      abi: p2pSuperformProxyFactoryAbi,
      functionName: 'deposit',
      args: [
        params.yieldProtocolCalldata,
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
      value: this.normalizeBigInt(params.value, 'value', 0n),
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
}
