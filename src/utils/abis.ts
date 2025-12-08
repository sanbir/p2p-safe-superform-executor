import type { Abi } from 'viem'

export const rolesModuleAbi = [
  {
    type: 'function',
    name: 'execTransactionWithRole',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'roleKey', type: 'bytes32' },
      { name: 'shouldRevert', type: 'bool' }
    ],
    outputs: [{ name: 'success', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'avatar',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    type: 'function',
    name: 'target',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  }
] as const satisfies Abi

export const p2pSuperformProxyFactoryAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [
      { name: '_yieldProtocolCalldata', type: 'bytes' },
      { name: '_clientBasisPointsOfDeposit', type: 'uint48' },
      { name: '_clientBasisPointsOfProfit', type: 'uint48' },
      { name: '_p2pSignerSigDeadline', type: 'uint256' },
      { name: '_p2pSignerSignature', type: 'bytes' }
    ],
    outputs: [{ name: 'p2pYieldProxyAddress', type: 'address' }]
  },
  {
    type: 'function',
    name: 'predictP2pYieldProxyAddress',
    stateMutability: 'view',
    inputs: [
      { name: '_client', type: 'address' },
      { name: '_clientBasisPointsOfDeposit', type: 'uint48' },
      { name: '_clientBasisPointsOfProfit', type: 'uint48' }
    ],
    outputs: [{ name: '', type: 'address' }]
  }
] as const satisfies Abi

export const p2pSuperformProxyAbi = [
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_superformCalldata', type: 'bytes' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'withdrawAccruedRewards',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_superformCalldata', type: 'bytes' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'calculateAccruedRewards',
    stateMutability: 'view',
    inputs: [
      { name: '_vaultId', type: 'uint256' },
      { name: '_asset', type: 'address' }
    ],
    outputs: [{ name: '', type: 'int256' }]
  },
  {
    type: 'function',
    name: 'batchClaim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_periodIds', type: 'uint256[]' },
      { name: '_rewardTokens', type: 'address[][]' },
      { name: '_amountsClaimed', type: 'uint256[][]' },
      { name: '_proofs', type: 'bytes32[][]' }
    ],
    outputs: []
  }
] as const satisfies Abi

const liqRequestComponents = [
  { name: 'txData', type: 'bytes' },
  { name: 'token', type: 'address' },
  { name: 'interimToken', type: 'address' },
  { name: 'bridgeId', type: 'uint8' },
  { name: 'liqDstChainId', type: 'uint64' },
  { name: 'nativeAmount', type: 'uint256' }
] as const

const singleVaultSfDataComponents = [
  { name: 'superformId', type: 'uint256' },
  { name: 'amount', type: 'uint256' },
  { name: 'outputAmount', type: 'uint256' },
  { name: 'maxSlippage', type: 'uint256' },
  { name: 'liqRequest', type: 'tuple', components: liqRequestComponents },
  { name: 'permit2data', type: 'bytes' },
  { name: 'hasDstSwap', type: 'bool' },
  { name: 'retain4626', type: 'bool' },
  { name: 'receiverAddress', type: 'address' },
  { name: 'receiverAddressSP', type: 'address' },
  { name: 'extraFormData', type: 'bytes' }
] as const

export const superformRouterSingleWithdrawAbi = [
  {
    type: 'function',
    name: 'singleDirectSingleVaultWithdraw',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'req_',
        type: 'tuple',
        components: [{ name: 'superformData', type: 'tuple', components: singleVaultSfDataComponents }]
      }
    ],
    outputs: []
  }
] as const satisfies Abi

export const erc4626Abi = [
  {
    type: 'function',
    name: 'asset',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  }
] as const satisfies Abi

export const rewardsDistributorAbi = [
  {
    type: 'function',
    name: 'batchClaim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'receiver_', type: 'address' },
      { name: 'periodIds_', type: 'uint256[]' },
      { name: 'rewardTokens_', type: 'address[][]' },
      { name: 'amountsClaimed_', type: 'uint256[][]' },
      { name: 'proofs_', type: 'bytes32[][]' }
    ],
    outputs: []
  }
] as const satisfies Abi

export const SafeOperation = {
  Call: 0,
  DelegateCall: 1
} as const

export type SafeOperationValue = (typeof SafeOperation)[keyof typeof SafeOperation]
