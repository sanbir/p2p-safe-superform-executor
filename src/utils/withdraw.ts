import { getAddress } from 'viem'
import type { Address } from 'viem'

export interface WithdrawStartResponse {
  to: Address
  method: string
  data: `0x${string}`
  value: string
}

export const buildWithdrawBody = (params: {
  userAddress: Address
  refundAddress: Address
  superformId: string
  superpositionsAmountIn: string
  superpositionsChainId: number | string
  toChainId: number | string
  toTokenAddress: Address
  vaultId: string
  bridgeSlippage: number
  swapSlippage: number
  positiveSlippage: number
  isErc20: boolean
  routeType?: string
  filterSwapRoutes?: boolean
  isPartOfMultiVault?: boolean
  needInsurance?: boolean
}) => ({
  bridge_slippage: params.bridgeSlippage,
  filter_swap_routes: params.filterSwapRoutes ?? false,
  is_erc20: params.isErc20,
  is_part_of_multi_vault: params.isPartOfMultiVault ?? false,
  need_insurance: params.needInsurance ?? true,
  positive_slippage: params.positiveSlippage,
  refund_address: getAddress(params.refundAddress),
  retain_4626: false,
  route_type: params.routeType ?? 'output',
  superform_id: params.superformId,
  superpositions_amount_in: params.superpositionsAmountIn,
  superpositions_chain_id: params.superpositionsChainId,
  swap_slippage: params.swapSlippage,
  to_chain_id: params.toChainId,
  to_token_address: getAddress(params.toTokenAddress),
  user_address: getAddress(params.userAddress),
  vault_id: params.vaultId
})

export const fetchWithdrawCalculate = async (params: {
  apiKey: string
  body: ReturnType<typeof buildWithdrawBody>
  fetcher?: typeof fetch
}): Promise<unknown> => {
  const fetchImpl = params.fetcher ?? fetch
  const response = await fetchImpl('https://api.superform.xyz/withdraw/calculate', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'SF-API-KEY': params.apiKey
    },
    body: JSON.stringify([params.body])
  })

  if (!response.ok) {
    const body = await safeReadBody(response)
    throw new Error(
      `Failed to calculate withdraw route (${response.status} ${response.statusText}): ${body}`
    )
  }

  const json = (await response.json()) as unknown[]
  return Array.isArray(json) ? json[0] : json
}

export const fetchWithdrawStart = async (params: {
  apiKey: string
  calculateResult: unknown
  fetcher?: typeof fetch
}): Promise<WithdrawStartResponse> => {
  const fetchImpl = params.fetcher ?? fetch
  const response = await fetchImpl('https://api.superform.xyz/withdraw/start', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'SF-API-KEY': params.apiKey
    },
    body: JSON.stringify([params.calculateResult])
  })

  if (!response.ok) {
    const body = await safeReadBody(response)
    throw new Error(`Failed to fetch withdraw calldata (${response.status} ${response.statusText}): ${body}`)
  }

  const json = (await response.json()) as
    | {
        to: string
        method: string
        data: `0x${string}`
        value: string
      }
    | Array<{
        to: string
        method: string
        data: `0x${string}`
        value: string
      }>

  const payload = Array.isArray(json) ? json[0] : json
  if (!payload) {
    throw new Error('Withdraw start response missing payload')
  }
  return {
    to: getAddress(payload.to),
    method: payload.method,
    data: payload.data,
    value: payload.value
  }
}

const safeReadBody = async (response: Response) => {
  try {
    return await response.text()
  } catch (error) {
    return `unable to read body: ${(error as Error).message}`
  }
}
