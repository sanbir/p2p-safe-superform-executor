# P2P Safe Superform Executor SDK

Helper SDK to execute P2P Superform deposit and withdraw flows against a Safe configured with the Zodiac Roles module.

## Installation

```bash
npm install @p2p-org/safe-superform-executor
```

## Environment

For the convenience helper `createExecutorFromEnv`, set:

- `RPC_URL` — HTTPS RPC endpoint
- `PRIVATE_KEY` — 0x-prefixed private key for the P2P module wallet (the address whitelisted in Roles)

## Usage

```ts
import { createExecutorFromEnv, P2pSafeSuperformExecutor } from '@p2p-org/safe-superform-executor'
import { optimism } from 'viem/chains'

// Option 1: build clients from PRIVATE_KEY/RPC_URL
const executor = createExecutorFromEnv({ chain: optimism })

// Option 2: provide any wallet/public client pair (WalletConnect, keystore, etc.)
const executor = new P2pSafeSuperformExecutor({
  walletClient,
  publicClient
})

await executor.deposit({
  safeAddress,
  rolesAddress,
  yieldProtocolCalldata,
  clientBasisPointsOfDeposit,
  clientBasisPointsOfProfit,
  p2pSignerSigDeadline,
  p2pSignerSignature
})

await executor.withdraw({
  safeAddress,
  rolesAddress,
  p2pSuperformProxyAddress,
  superformCalldata
})

await executor.withdrawAccruedRewards({
  safeAddress,
  rolesAddress,
  p2pSuperformProxyAddress,
  superformCalldata // rewards withdraw calldata
})

// Note: withdrawAccruedRewards will decode the calldata, verify the accrued
// rewards on-chain via calculateAccruedRewards, and only send the Roles tx if
// the provided amount matches the accrued rewards.
```

Default constants (including `P2P_SUPERFORM_PROXY_FACTORY_ADDRESS`) are exported from `constants`, and you can override the role key or factory address when constructing the executor if needed.
