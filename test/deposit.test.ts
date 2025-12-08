import assert from 'node:assert/strict'
import test from 'node:test'
import { decodeFunctionData } from 'viem'

import { p2pSuperformProxyFactoryAbi } from '../src/utils/abis'
import { P2pSafeSuperformExecutor } from '../src/core/executor'
import type { DepositParams, ExecutorConfig } from '../src/core/types'

const factoryAddress = '0xF000000000000000000000000000000000000001'
const rolesAddress = '0xF000000000000000000000000000000000000002'
const safeAddress = '0xF000000000000000000000000000000000000003'
const proxyAddress = '0x8D1a5E9FE73529c4444Aa07ABD6D76C98d32394b'
const moduleAddress = '0xF0000000000000000000000000000000000000AA'

const depositStartResponse = {
  to: '0xa195608C2306A26f727d5199D5A382a4508308DA',
  method: 'singleDirectSingleVaultDeposit',
  data: '0xb19dcc330000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000021050000000181d5cef48bff2dde1b15d6c592ae14383c52d8f60000000000000000000000000000000000000000000000000000000000001388000000000000000000000000000000000000000000000000000000000000117b000000000000000000000000000000000000000000000000000000000000003200000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000240000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008d1a5e9fe73529c4444aa07abd6d76c98d32394b0000000000000000000000008d1a5e9fe73529c4444aa07abd6d76c98d32394b000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  value: '0'
}

const mockFetch: typeof fetch = async (url, _init) => {
  if (typeof url === 'string' && url.includes('/deposit/calculate')) {
    return new Response(JSON.stringify([{}]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }

  return new Response(JSON.stringify(depositStartResponse), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })
}

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
      if (args.functionName === 'predictP2pYieldProxyAddress') {
        return proxyAddress
      }
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
    p2pSuperformProxyFactoryAddress: factoryAddress,
    superformApiKey: 'test-key',
    fetcher: mockFetch,
    validateRolesTarget: false
  })

  return { executor, writes }
}

const baseDepositParams: Omit<DepositParams, 'rolesAddress' | 'safeAddress'> = {
  fromTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  amountIn: '0.005',
  vaultId: '2GoghTk010_A08iZkKpgg',
  bridgeSlippage: 0,
  swapSlippage: 0,
  routeType: 'output',
  clientBasisPointsOfDeposit: 10_000,
  clientBasisPointsOfProfit: 9_700,
  p2pSignerSigDeadline: 123n,
  p2pSignerSignature: '0x' as `0x${string}`
}

test('deposit builds calldata from Superform API and routes via Roles', async () => {
  const { executor, writes } = makeExecutor()

  const txHash = await executor.deposit({
    ...baseDepositParams,
    rolesAddress,
    safeAddress
  })

  assert.equal(txHash, '0xhash')
  assert.equal(writes.length, 1)
  const call = writes[0]
  assert.equal(call.address, rolesAddress)

  const decoded = decodeFunctionData({
    abi: p2pSuperformProxyFactoryAbi,
    data: call.args[2]
  })

  assert.equal(decoded.functionName, 'deposit')
  const [yieldProtocolCalldata] = decoded.args as [string]
  assert.equal(yieldProtocolCalldata, depositStartResponse.data)
})
