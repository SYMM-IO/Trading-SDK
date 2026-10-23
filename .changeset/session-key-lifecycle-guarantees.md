---
"@symmio/session-key": minor
---

**Safer session-key lifecycle.**

- **`onLoadError: "rotate" | "throw"`** decides what `initialize` does when the storage adapter's `load` throws. The default, `"rotate"`, keeps today's behavior: the record is removed and a new, undelegated key is generated. `"throw"` leaves the stored record untouched, clears the in-memory key, and rejects with the new `SessionKeyLoadError`, so an app can retry or ask before replacing a key that may still be delegated.
- **Lifecycle calls no longer interleave.** `initialize`, `importPrivateKey`, `rotate` and `destroy` run one after another on a manager, and concurrent `initialize(owner)` calls share one run. Starting a newer lifecycle request revokes the current in-memory signer synchronously; an older request that was still running rejects with `SessionKeyOperationSupersededError` instead of publishing stale key material.
- **Competing writers are reconciled on a best-effort basis.** After saving, the manager checks the stored metadata and adopts a different key it observes. A write that lands after the final read can still supersede this manager, so consumers that need strict cross-tab coordination must provide it at their storage boundary.
