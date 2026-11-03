---
"@symmio/trading-react": minor
---

**`SymmioProvider` accepts a custom read client.** The new optional `getClient` prop replaces wagmi's public client for every on-chain SDK read, every write's dry-run and every receipt wait. An app that reads through its own viem client (a dedicated RPC URL, request batching, an instrumented transport) now keeps that client under the SDK hooks too. Without the prop, the provider reads through wagmi exactly as before. Memoize the resolver: a new function identity rebuilds the SDK config.
