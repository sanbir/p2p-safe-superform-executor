import type { Chain } from 'viem'

import { createClientsFromPrivateKey } from './adapters'
import { loadEnv } from './config/env'
import * as constants from './constants'
import { P2pSafeSuperformExecutor } from './core/executor'
import type {
  DepositParams,
  ExecutorConfig,
  PredictProxyAddressParams,
  WithdrawParams
} from './core/types'
import { SafeOperation, type SafeOperationValue } from './utils/abis'

export {
  P2pSafeSuperformExecutor,
  loadEnv,
  createClientsFromPrivateKey,
  constants,
  SafeOperation
}
export type {
  DepositParams,
  ExecutorConfig,
  PredictProxyAddressParams,
  SafeOperationValue,
  WithdrawParams
}

export const createExecutorFromEnv = (params: {
  chain: Chain
  batchRpc?: boolean
}) => {
  const env = loadEnv()

  if (!env.RPC_URL) {
    throw new Error('RPC_URL must be defined to create clients from environment')
  }
  if (!env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY must be defined to create clients from environment')
  }

  const { publicClient, walletClient } = createClientsFromPrivateKey({
    rpcUrl: env.RPC_URL,
    privateKey: env.PRIVATE_KEY as `0x${string}`,
    chain: params.chain,
    batch: params.batchRpc
  })

  return new P2pSafeSuperformExecutor({
    walletClient,
    publicClient
  })
}
