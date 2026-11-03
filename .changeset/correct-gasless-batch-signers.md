---
"@symmio/trading-core": minor
"@symmio/trading-react": patch
---

Support per-entry signers on GaslessWallet batch entries and resolve default wallets only when needed. Validate owner grants in execution order before counting their permissions for later contract or wallet entries, including canonical virtual-account delegation scope.

Refresh delegation status, expiry, active delegations, and pending revocations after either grant form in a confirmed React batch.
