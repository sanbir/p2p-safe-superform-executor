import type { Account, Address, Chain, Hex, PublicClient, Transport, WalletClient } from 'viem'

import type { SafeOperationValue } from '../utils/abis'

export interface ExecutorConfig<TTransport extends Transport = Transport, TChain extends Chain = Chain> {
  walletClient: WalletClient<TTransport, TChain, Account>
  publicClient: PublicClient<TTransport, TChain>
  p2pSuperformProxyFactoryAddress?: Address
  p2pModuleAddress?: Address
  defaultRoleKey?: Hex
  logger?: (message: string) => void
  superformApiKey?: string
  fetcher?: typeof fetch
  /**
   * Validate that the provided Roles module is wired to the expected Safe address.
   * Disable if you want to skip the additional read calls.
   */
  validateRolesTarget?: boolean
}

export interface DepositParams {
  safeAddress: Address
  rolesAddress: Address
  fromTokenAddress: Address
  amountIn: string
  vaultId: string
  bridgeSlippage: number
  swapSlippage: number
  routeType: string
  excludeAmbs?: number[]
  excludeLiquidityProviders?: number[]
  excludeDexes?: number[]
  excludeBridges?: number[]
  clientBasisPointsOfDeposit: bigint | number
  clientBasisPointsOfProfit: bigint | number
  p2pSignerSigDeadline: bigint | number
  p2pSignerSignature: Hex
  /**
   * Native value forwarded from the Safe to the factory call, use for native deposits.
   * Defaults to 0.
   */
  value?: bigint | number
  roleKey?: Hex
  shouldRevertOnFailure?: boolean
  operation?: SafeOperationValue
}

export interface WithdrawParams {
  safeAddress: Address
  rolesAddress: Address
  p2pSuperformProxyAddress: Address
  superformId: string
  vaultId: string
  superpositionsAmountIn: string
  toTokenAddress: Address
  bridgeSlippage: number
  swapSlippage: number
  positiveSlippage: number
  isErc20: boolean
  routeType?: string
  filterSwapRoutes?: boolean
  isPartOfMultiVault?: boolean
  needInsurance?: boolean
  value?: bigint | number
  roleKey?: Hex
  shouldRevertOnFailure?: boolean
  operation?: SafeOperationValue
}

export interface WithdrawAccruedRewardsParams {
  safeAddress: Address
  rolesAddress: Address
  p2pSuperformProxyAddress: Address
  superformCalldata: Hex
  value?: bigint | number
  roleKey?: Hex
  shouldRevertOnFailure?: boolean
  operation?: SafeOperationValue
}

export interface BatchClaimParams {
  safeAddress: Address
  rolesAddress: Address
  p2pSuperformProxyAddress: Address
  value?: bigint | number
  roleKey?: Hex
  shouldRevertOnFailure?: boolean
  operation?: SafeOperationValue
}

export interface RolesExecutionParams {
  rolesAddress: Address
  target: Address
  data: Hex
  value?: bigint | number
  roleKey?: Hex
  shouldRevertOnFailure?: boolean
  operation?: SafeOperationValue
  expectedSafe?: Address
}

export interface PredictProxyAddressParams {
  client: Address
  clientBasisPointsOfDeposit: bigint | number
  clientBasisPointsOfProfit: bigint | number
  factoryAddress?: Address
}
