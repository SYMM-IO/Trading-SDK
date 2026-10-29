---
"@symmio/trading-core": minor
---

**Caller-owned idempotency keys for gasless writes.**

- **`gasless.idempotencyKey`** on every relayable write, and an `idempotencyKey` parameter on `relayGaslessBatch`, `gaslessWalletExecute` and `relayGrantDelegation` (shared `GaslessIdempotencyKeyParameter`; `relayInstantOperations` and both deposit settlements adopt it). Give each user action its own key, save it before calling, and call again under the same key after an unknown outcome: while the service holds a key, it accepts it at most once. A key makes a transparent write strictly gasless — no wallet path and no automatic fallback; combining it with `enabled: false` or `fallback: "wallet"` throws the new `GASLESS_IDEMPOTENCY_KEY_INVALID` before any prompt, as does a blank key or one longer than 128 characters.
- **Same-key retries never wait for their own pending submit.** A retry under the same key signs at once instead of waiting up to two minutes on the nonce stream and failing with `GASLESS_NONCE_STREAM_BUSY`. When the config already saw that key accepted, the retry follows the earlier request (or returns its receipt) without signing. Different keys still wait for each other.
- **Signature deadlines are fixed when a call starts**, so an attempt started at `T` can never execute after `T + GASLESS_SIGNATURE_LIFETIME_SECONDS` (new export, 20 minutes).
- **New helpers:** `generateGaslessIdempotencyKey` creates a key for one user action; `getGaslessDeploymentKey` fingerprints the deployment a key belongs to, to check before any retry; `isConfirmedGaslessRefusalError` is the SDK's own wallet-fallback rule; `isGaslessRequestRejectedOrRevertedError` tells when an accepted request ended without any on-chain effect (a `failed` request is not included — its transaction may still mine).
