import { decodeFunctionData, encodeFunctionData, getAddress } from 'viem'
import type { Address, Hex } from 'viem'
import { z } from 'zod'

import { p2pSuperformProxyAbi, rewardsDistributorAbi } from './abis'

const claimResponseSchema = z.object({
  transactionData: z.string().regex(/^0x[0-9a-fA-F]*$/u, { message: 'transactionData must be 0x-hex' }),
  to: z.string().regex(/^0x[0-9a-fA-F]{40}$/u, { message: 'to must be an address' })
})

export type ProtocolRewardsClaimResponse = z.infer<typeof claimResponseSchema> & {
  transactionData: Hex
  to: Address
}

export const fetchProtocolRewardsClaim = async (params: {
  chainId: number | string
  user: Address
  apiKey: string
  fetcher?: typeof fetch
}): Promise<ProtocolRewardsClaimResponse> => {
  const fetchImpl = params.fetcher ?? fetch
  const url = `https://api.superform.xyz/protocolRewards/claim/${params.chainId}/${params.user}`

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'SF-API-KEY': params.apiKey
    }
  })

  if (!response.ok) {
    const body = await safeReadBody(response)
    throw new Error(
      `Failed to fetch rewards claim data (${response.status} ${response.statusText}): ${body}`
    )
  }

  const json = await response.json()
  return parseProtocolRewardsClaimResponse(json)
}

export const parseProtocolRewardsClaimResponse = (json: unknown): ProtocolRewardsClaimResponse => {
  const parsed = claimResponseSchema.parse(json)
  return {
    transactionData: parsed.transactionData as Hex,
    to: getAddress(parsed.to)
  }
}

export interface DecodedRewardsDistributorBatchClaim {
  receiver: Address
  periodIds: bigint[]
  rewardTokens: Address[][]
  amountsClaimed: bigint[][]
  proofs: readonly Hex[][]
}

export const decodeRewardsDistributorBatchClaim = (transactionData: Hex): DecodedRewardsDistributorBatchClaim => {
  const decoded = decodeFunctionData({
    abi: rewardsDistributorAbi,
    data: transactionData
  })

  if (decoded.functionName !== 'batchClaim') {
    throw new Error('transactionData selector is not batchClaim')
  }

  const [receiver, periodIds, rewardTokens, amountsClaimed, proofs] = decoded.args as [
    Address,
    bigint[],
    Address[][],
    bigint[][],
    readonly Hex[][]
  ]

  return {
    receiver: getAddress(receiver),
    periodIds,
    rewardTokens: rewardTokens.map((tokens) => tokens.map((token) => getAddress(token))),
    amountsClaimed,
    proofs
  }
}

export const buildProxyBatchClaimCalldata = (
  decoded: DecodedRewardsDistributorBatchClaim
): { data: Hex; args: ProxyBatchClaimArgs } => {
  const args: ProxyBatchClaimArgs = {
    periodIds: decoded.periodIds,
    rewardTokens: decoded.rewardTokens,
    amountsClaimed: decoded.amountsClaimed,
    proofs: decoded.proofs
  }

  return {
    data: encodeProxyBatchClaim(args),
    args
  }
}

type ProxyBatchClaimArgs = {
  periodIds: bigint[]
  rewardTokens: Address[][]
  amountsClaimed: bigint[][]
  proofs: readonly Hex[][]
}

const encodeProxyBatchClaim = (args: ProxyBatchClaimArgs): Hex =>
  encodeFunctionData({
    abi: p2pSuperformProxyAbi,
    functionName: 'batchClaim',
    args: [args.periodIds, args.rewardTokens, args.amountsClaimed, args.proofs]
  })

const safeReadBody = async (response: Response) => {
  try {
    return await response.text()
  } catch (error) {
    return `unable to read body: ${(error as Error).message}`
  }
}
