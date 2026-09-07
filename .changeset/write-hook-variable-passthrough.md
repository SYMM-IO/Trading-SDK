---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Restore the per-call `gasless` opt-in in React, and finish the relayable-write surface it depends on.

Twenty write hooks built the core action's parameters by hand-listing fields off the mutation
`variables` instead of forwarding them, so `gasless` and `from` never reached the action. The failure
was silent and invisible to the compiler: the variables generic is the core parameters type, so
`mutate({ …, gasless: true })` type-checked and was then discarded. Only the config-level
`execution.mode: "gasless"` actually worked — which is why the docs' own React example never did.

**`@symmio/trading-react`**

- Write hooks now forward their mutation variables verbatim (`{ ...variables, chainId }`), so `gasless`
  and `from` reach the core action. Affects `useAllocate`, `useDeallocate`,
  `useDeallocateAndInitiateWithdraw`, `useAddMargin`, `useRemoveMargin`, `useInitiateWithdraw`,
  `useRequestCancelWithdraw`, `useFinalizeWithdrawRequest`, `useRequestToCancelQuote`,
  `useRequestToCancelCloseRequest`, `useForceCancelQuote`, `useForceCancelCloseRequest`, and the eight
  writes that were dropping only `from`.
- **Two behavior flips follow from that, both previously unreachable from React.** An explicit
  `gasless: true` on a chain carrying no gasless block now throws `GASLESS_NOT_CONFIGURED` instead of
  quietly paying gas; and `gasless: false` now genuinely forces the wallet path on a chain running in
  `execution.mode: "gasless"`. Config-driven mode still degrades silently, unchanged.
- `useWithdraw` now passes its own `config` to the `useSubAccount` read it uses to resolve isolation,
  instead of falling back to the provider's config.

**`@symmio/trading-core`**

- `finalizeWithdrawRequest` accepts `gasless` and dispatches through the relay seam. Its selector was
  already registered as relayable and documented as such, but the action had no seam — so a gasless
  withdraw dead-ended at the final step on a wallet holding no native token. The operation is signed by
  the request's own `user` sub-account (override with `gasless.account`); it is the only relayable write
  that targets the diamond directly rather than through `_call`, because it is permissionless.
- `GaslessWriteOptions` and `GaslessWriteParameter` are now exported. The config-side types were public
  while the per-call types were not, so consumers could not name the bag the docs told them to pass.
- `FromParameter`'s documentation now states all three of its roles — simulation `msg.sender`,
  wallet-client hint on a write, and EIP-712 signer on a relay. It previously claimed to default to the
  connected wallet in React, which is true only of the `useSimulate*` hooks.
