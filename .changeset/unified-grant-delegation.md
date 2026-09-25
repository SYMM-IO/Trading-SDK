---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

One `grantDelegation`, with the transport chosen by config.

Granting a delegation was the only write with two hooks — `useGrantDelegation` for the wallet path and `useRelayGrantDelegation` for the gasless one — while every other relayable write is a single hook whose transport comes from `gasless.execution.mode`. That split was an artifact: `GASLESS_RELAYABLE_SELECTORS` was derived from the dispatcher's allow-list _and_ documented as the set to grant a session key, so registering `grantDelegation` as relayable would also have handed session keys the power to re-delegate. It was left out instead, and a parallel relay action was written around it.

- **`grantDelegation` is now a relayable write.** It takes the `gasless` write parameter like `allocate` or `addMargin`, and returns the relayer's broadcast hash where a wallet hash would be — so `GrantDelegationReturnType` is still `Hash`, and receipt waits and cache invalidation are unchanged. Onboarding a session key from a wallet with no native balance now works through the ordinary action.
- **A `isPartyB: true` grant cannot be relayed** — the signed-operation encoder has no PartyB form. It degrades to the wallet path, or throws `GASLESS_PARTYB_UNSUPPORTED` when `gasless: true` was demanded explicitly.
- **New `GASLESS_SESSION_KEY_SELECTORS`** — the set to grant a session key: every relayable selector except `grantDelegation`. **`GASLESS_RELAYABLE_SELECTORS` now includes `grantDelegation`** and is no longer a delegation set; granting it would let a key mint itself further delegations over any selector and any expiry. Anywhere you passed it as `selectors`, switch to the new constant. A test pins the exclusion.
- **`useRelayGrantDelegation` is removed** — use `useGrantDelegation`, which relays under gasless mode. The core `relayGrantDelegation` action stays as the low-level escape hatch, exactly as `relayInstantOperations` sits beside the transparent path.
- **`useGrantDelegation`'s invalidation is fixed and widened**: it was invalidating delegation reads across _every_ chain config (no `configKey` scope), and it now also invalidates the InstantLayer nonce, the operational-fee allowance and account balances — a deliberate superset, since the hook cannot see which transport ran and a stale allowance silently blocks the next relay.
