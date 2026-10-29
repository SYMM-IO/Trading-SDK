---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

**One-signature delegation setup.**

- **`grantDelegations` / `useGrantDelegations`** (plus `simulateGrantDelegations` / `useSimulateGrantDelegations`) grant several delegates of one account in a single `InstantLayer.grantDelegations` call. Relayed, that is one owner signature instead of one per delegate. An empty list or a PartyB account fails before any prompt with `GRANT_DELEGATIONS_EMPTY` / `GRANT_DELEGATIONS_PARTYB_UNSUPPORTED`. The InstantLayer ABI is re-pinned to the full perps-core v0.8.6 file, which adds `grantDelegations` and `TEMPLATE_MANAGER_ROLE`.
- **Per-call signers in `relayGaslessBatch`.** A write call takes an optional `from`, so one batch can mix signers. The delegation pre-flight credits a grant made earlier in the same batch, and in-memory signers such as a session key sign before any wallet prompt. "The owner grants a key, the key approves the fee charger" is now one wallet prompt.
- **`approveOperationalFeeAllowance` / `useApproveOperationalFeeAllowance`** set a fee allowance with the diamond's two-argument `approveOperationalFee`, leaving the fee multiplier untouched. It is relayable under its own selector, so a session key delegated only that selector can sign it.
- **`useGrantDelegation` refreshes more, and on the right chain.** It now also invalidates `getActiveDelegations` and `getPendingRevocationEtas` reads, which a grant changes. It keys every refresh on the chain the write went to; an omitted `chainId` used to refresh the wallet's chain instead.
