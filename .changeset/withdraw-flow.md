---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add a one-call withdraw flow — deallocate and initiate a withdrawal in a single action, with the cross-margin path handled for the caller.

`deallocateAndInitiateWithdraw` batches the `deallocate` and `initiateWithdraw` legs through the AccountLayer `_call` proxy so both are attributed to the subaccount (the connected wallet must be its on-chain `owner`). The `deallocate` leg needs a fresh, short-lived Muon `uPnl_A` attestation to prove the subaccount stays solvent; the action fetches one immediately before submitting (via `getDeallocateUpnlSig`) unless the caller passes a `upnlSig` to reuse. Its `amount` is in **18 decimals**; `parts` are the withdraw receiver parts (a plain same-chain withdrawal is a single `createClassicWithdrawPart`). `simulateDeallocateAndInitiateWithdraw` is its dry-run twin.

`withdrawAuto` is the convenience entry point: it takes an `amount` in the **collateral token's own decimals** and a `receiver`, resolves the subaccount's isolation type, and picks the right path — a plain `withdraw` when the balance is already available, or the deallocate-and-initiate path for cross-margin (`CUSTOM`) accounts, scaling the amount to the 18-decimal figure the `deallocate` leg needs. `withdraw` is the underlying base write. All three carry the `speedUp` cooldown opt-in and opaque `providerData` for express/virtual providers.

`@symmio/trading-react` adds `useWithdraw` (over `withdrawAuto`) and `useDeallocateAndInitiateWithdraw` (over the explicit batched action), so a UI can offer either the one-input convenience or the fully-specified flow.
