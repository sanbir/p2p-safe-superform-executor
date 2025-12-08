import { getAddress } from 'viem'
import type { Address } from 'viem'

export interface DepositStartResponse {
  to: Address
  method: string
  data: `0x${string}`
  value: string
}

export const buildDepositBody = (params: {
  userAddress: Address
  fromTokenAddress: Address
  fromChainId: number | string
  amountIn: string
  refundAddress: Address
  vaultId: string
  bridgeSlippage: number
  swapSlippage: number
  routeType: string
  excludeAmbs?: number[]
  excludeLiquidityProviders?: number[]
  excludeDexes?: number[]
  excludeBridges?: number[]
}) => ({
  user_address: getAddress(params.userAddress),
  from_token_address: getAddress(params.fromTokenAddress),
  from_chain_id: params.fromChainId,
  amount_in: params.amountIn,
  refund_address: getAddress(params.refundAddress),
  vault_id: params.vaultId,
  bridge_slippage: params.bridgeSlippage,
  swap_slippage: params.swapSlippage,
  route_type: params.routeType,
  exclude_ambs: params.excludeAmbs ?? [],
  exclude_liquidity_providers: params.excludeLiquidityProviders ?? [],
  exclude_dexes: params.excludeDexes ?? [],
  exclude_bridges: params.excludeBridges ?? []
})

export const fetchDepositStart = async (params: {
  apiKey: string
  body: ReturnType<typeof buildDepositBody>
  fetcher?: typeof fetch
}): Promise<DepositStartResponse> => {
  const fetchImpl = params.fetcher ?? fetch
  const response = await fetchImpl('https://api.superform.xyz/deposit/start', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'SF-API-KEY': params.apiKey
    },
    body: JSON.stringify(params.body)
  })

  if (!response.ok) {
    const body = await safeReadBody(response)
    throw new Error(`Failed to fetch deposit calldata (${response.status} ${response.statusText}): ${body}`)
  }

  const json = (await response.json()) as {
    to: string
    method: string
    data: `0x${string}`
    value: string
  }
  return {
    to: getAddress(json.to),
    method: json.method,
    data: json.data,
    value: json.value
  }
}

const safeReadBody = async (response: Response) => {
  try {
    return await response.text()
  } catch (error) {
    return `unable to read body: ${(error as Error).message}`
  }
}
