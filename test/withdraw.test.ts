import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeFunctionData } from 'viem'

import { p2pSuperformProxyAbi } from '../src/utils/abis'
import { P2pSafeSuperformExecutor } from '../src/core/executor'
import type { ExecutorConfig, WithdrawParams } from '../src/core/types'

const rolesAddress = '0xF000000000000000000000000000000000000002'
const safeAddress = '0xF000000000000000000000000000000000000003'
const proxyAddress = '0x8D1a5E9FE73529c4444Aa07ABD6D76C98d32394b'
const moduleAddress = '0xF0000000000000000000000000000000000000AA'

const withdrawStartResponse = {
  to: '0xa195608C2306A26f727d5199D5A382a4508308DA',
  method: 'singleDirectSingleVaultWithdraw',
  data: '0x407c7b1d0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000021050000000181d5cef48bff2dde1b15d6c592ae14383c52d8f6000000000000000000000000000000000000000000000000000000000000117d0000000000000000000000000000000000000000000000000000000000001389000000000000000000000000000000000000000000000000000000000000138800000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000240000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008d1a5e9fe73529c4444aa07abd6d76c98d32394b0000000000000000000000008d1a5e9fe73529c4444aa07abd6d76c98d32394b000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  value: '0'
}

const mockFetch: typeof fetch = async (_url, _init) =>
  new Response(JSON.stringify(withdrawStartResponse), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

const makeExecutor = () => {
  const writes: any[] = []

  const walletClient = {
    account: { address: moduleAddress },
    chain: { id: 8453 },
    writeContract: async (args: any) => {
      writes.push(args)
      return '0xhash'
    }
  } as unknown as ExecutorConfig['walletClient']

  const publicClient = {
    readContract: async (args: any) => {
      if (args.functionName === 'avatar' || args.functionName === 'target') {
        return safeAddress
      }
      return null
    },
    waitForTransactionReceipt: async () => ({})
  } as unknown as ExecutorConfig['publicClient']

  const executor = new P2pSafeSuperformExecutor({
    walletClient,
    publicClient,
    superformApiKey: 'test-key',
    fetcher: mockFetch,
    validateRolesTarget: false
  })

  return { executor, writes }
}

const baseWithdrawParams: Omit<WithdrawParams, 'rolesAddress' | 'safeAddress' | 'p2pSuperformProxyAddress'> = {
  superformId: '53060340969225815226237768346742701413530550720430230111181046',
  vaultId: '2GoghTk010_A08iZkKpgg',
  superpositionsAmountIn: '4477',
  toTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  bridgeSlippage: 5000,
  swapSlippage: 5000,
  positiveSlippage: 5000,
  isErc20: false,
  routeType: 'output'
}

test('withdraw builds calldata from Superform API and routes via Roles', async () => {
  const { executor, writes } = makeExecutor()

  const txHash = await executor.withdraw({
    ...baseWithdrawParams,
    rolesAddress,
    safeAddress,
    p2pSuperformProxyAddress: proxyAddress
  })

  assert.equal(txHash, '0xhash')
  assert.equal(writes.length, 1)
  const call = writes[0]
  assert.equal(call.address, rolesAddress)

  const decoded = decodeFunctionData({
    abi: p2pSuperformProxyAbi,
    data: call.args[2]
  })

  assert.equal(decoded.functionName, 'withdraw')
  const [superformCalldata] = decoded.args as [string]
  assert.equal(superformCalldata, withdrawStartResponse.data)
})
