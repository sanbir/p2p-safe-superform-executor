import type { Address, Hex } from 'viem'
import { keccak256, stringToHex } from 'viem'

export const P2P_ADDRESS =
  '0x03264232431031B6484188640ECFF7BdaBDA4b8b' as const satisfies Address

export const P2P_SUPERFORM_PROXY_FACTORY_ADDRESS =
  '0x815B6A7c0b8F4D1c7cdb5031EBe802bf4f7e6d81' as const satisfies Address

export const SAFE_RPC_URL = process.env.RPC_URL || ''
export const SAFE_OPERATOR_PRIVATE_KEY = process.env.PRIVATE_KEY || ''

export const DEFAULT_ROLE_KEY = keccak256(
  stringToHex('P2P_SUPERFORM_ROLE')
) as Hex
