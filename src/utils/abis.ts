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
  }
] as const satisfies Abi

export const SafeOperation = {
  Call: 0,
  DelegateCall: 1
} as const

export type SafeOperationValue = (typeof SafeOperation)[keyof typeof SafeOperation]
