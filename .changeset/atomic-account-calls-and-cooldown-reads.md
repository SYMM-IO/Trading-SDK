---
"@symmio/trading-core": minor
---

Add executeAccountCalls for atomic named SYMMIO core writes through AccountLayer or the configured gasless dispatcher. Reuse simulation, owner validation and relay restrictions without adding automatic wallet fallback.

Expose getWithdrawCooldownOf and getDeallocateDebounceTime with deployment-scoped query factories for withdrawal and deallocation readiness.
