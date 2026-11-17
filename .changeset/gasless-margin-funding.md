---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add opt-in gasless batch and margin fee-funding reads with per-payer post-operation balance projections, structured shortfalls, and an applicable fee-safe add-margin bound. Expose matching query options and thin React hooks. Read all payer balances at one fresh RPC block to prevent mixed-block allocation reads from double-counting or omitting collateral. Existing relay defaults, signing, recovery, and wallet fallback remain unchanged; funding previews do not guarantee execution.
