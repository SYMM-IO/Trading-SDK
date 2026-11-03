---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add executeAccountCalls for atomic named SYMMIO core writes through AccountLayer or the configured gasless dispatcher. Reuse simulation, owner validation and relay restrictions without adding automatic wallet fallback.

Expose getWithdrawCooldownOf and getDeallocateDebounceTime with deployment-scoped query factories for withdrawal and deallocation readiness, and the matching `useWithdrawCooldownOf` and `useDeallocateDebounceTime` hooks. `useDeallocate`, `useDeallocateAndInitiateWithdraw`, `useWithdraw` and relayed batches that deallocate now refresh the withdraw-cooldown read; `useDeallocate` and deallocating batches also refresh the withdrawable time, which the deallocation moves.
