---
"@symmio/trading-react": minor
---

Add `useGaslessWalletExecuteSelectors`, the React binding for the selector set a session key needs to sign a delegated wallet batch.

`gaslessWalletExecute` is authorized selector by selector: the GaslessLayer probes a wallet-execution sentinel plus every inner call's own selector. Core has exposed `getGaslessWalletExecuteSelectors` for that since the wallet-execute slice landed, but no React binding did, so a React consumer could offer the session-key path and had no supported way to grant the authority it needs — the call could only ever reject with `GASLESS_SIGNER_NOT_DELEGATED`. `useSessionKeySelectors` does not cover it: that set is the trade lifecycle plus gasless account management, and none of those selectors appear in a wallet batch.

```tsx
const selectors = useGaslessWalletExecuteSelectors({ calls });
const delegation = useAreDelegationsActive({ account, delegate: sessionKey, selectors });

if (!delegation.allActive) {
  await grant.mutateAsync({ account, delegatedSigner: sessionKey, selectors, expiryTimestamp, gasless: true });
}
```

The grant is scoped to the batch on screen, so a different call form or inner function needs its own grant, and it must be granted on a sub-account — `grantDelegation` is owner-only and the AccountLayer knows no owner for a bare EOA. Passing `calls: undefined` returns an empty set rather than a partial grant, and the result keeps its reference while the selector set is unchanged, so a batch rebuilt on every keystroke does not churn a dependent query.
