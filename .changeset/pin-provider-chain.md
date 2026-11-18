---
"@symmio/trading-react": minor
---

Add an optional `chainId` prop to `SymmioProvider` that pins `config.defaultChainId`, no-arg `config.getChainConfig()` and `useSymmioChainId()` to one chain, whatever chain the connected wallet is on. Single-chain apps use it so a wallet on another supported chain cannot move SDK defaults there. Without the prop, behavior is unchanged.
