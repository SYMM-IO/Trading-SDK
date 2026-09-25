---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Relay several gasless actions as one request, and preview what they cost before any signature.

The relay already accepted many signed operations in one atomic `relay-instant` request, but only `relayInstantOperations` could send one, and only for operations the caller built, nonced and signed by hand. Every SDK action relayed alone. The fee preview had the same gap: `getGaslessFeeQuote` needed fully built operations, including a random salt and deadline that changed its query key on every render.

**`@symmio/trading-core`**

- New `relayGaslessBatch` (plus `relayGaslessBatchMutationOptions`). It takes a list of calls and relays them as one atomic transaction. Relayable writes are named by function — `{ functionName: "allocate", args }`, no ABI needed — or given as raw `{ data }`, and GaslessWallet calls join the same batch as `{ walletCalls, walletId }`. Before any prompt it resolves each write's contract from its selector, checks a session key's delegations, sequences nonces on every stream the batch signs on (the account's InstantLayer stream and one stream per wallet id), and previews the fee. It then signs each operation (the protocol has no batch signature, so a wallet prompts once per call) and submits once.
- New `getGaslessBatchFeeQuote` (plus `getGaslessBatchFeeQuoteQueryKey` / `getGaslessBatchFeeQuoteQueryOptions`). It returns the `previewFeeQuote` for the same calls, with no operation to build. The result depends only on the account and the calls. Its query key holds encoded calldata instead of ABIs, and it stays deterministic while arguments do not yet encode.
- New `getGaslessBatchSelectors` — the delegation set a session key needs to relay a batch.
- New `GASLESS_RELAYABLE_FUNCTIONS` — every relayable write's ABI item, keyed by function name.
- New types `GaslessBatchCall`, `GaslessBatchContractCall`, `GaslessBatchRawCall` and `GaslessBatchWalletExecute`.
- Internal: the per-stream nonce lock now queues a task on several streams in one step, so a batch holding the InstantLayer stream and a wallet stream cannot deadlock with another batch, and its pending signatures are recorded on every stream it signed on. The dispatcher's gateway-coherence probe, owner cache and delegation pre-flight moved to shared modules, with no behavior change.

**`@symmio/trading-react`**

- New `useRelayGaslessBatch`. It confirms like the other relay hooks. Because every call is a known relayable write, it refreshes exactly the domains the batch touched: withdrawal requests, quotes and positions, sub-account lists, collateral, delegations, and each wallet entry's reads.
- New `useGaslessBatchFeeQuote`. It debounces a changing batch internally (`debounceMs`, default 500), keyed on the calls' content rather than identity, so a form that rebuilds its calls on every keystroke reads the GaslessLayer once per pause.
- Re-exports `GASLESS_RELAYABLE_FUNCTIONS`.
