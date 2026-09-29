---
"@symmio/trading-core": minor
---

Relay six more writes through the gasless service, and stop the session-key selector set from growing with them.

Gasless coverage was partial for a reason that no longer holds. Under perps-core 0.8.5 a relayed AccountLayer call
arrived with the InstantLayer as `msg.sender`, so any write that derived identity from its caller — creating an account,
renaming one, depositing — would have attributed the result to the relayer. In 0.8.6 the InstantLayer scopes the call to
the account owner before dispatching it, so the AccountLayer's signer resolves to the user's own wallet and those writes
became relayable. The vendor's own frontend already relays two of them against the same deployment.

**`@symmio/trading-core`**

- `forceClosePosition` and `forceCloseAuto` now accept `gasless`. The write already routed through the AccountLayer
  `_call` proxy, so only the selector registration and the parameter were missing — under a chain running in
  `execution.mode: "gasless"` it had been silently falling back to the wallet path.
- `createSubAccounts`, `deleteSubAccount`, `editAccountName`, `depositForAccount` and `depositAndAllocateForAccount` now
  accept `gasless` and dispatch through the transparent seam.
- `createSubAccounts` requires `gasless.account` when relayed: every operation is signed under an account the
  InstantLayer resolves on chain, and the subaccounts being created do not exist yet. Without it the call throws
  `GASLESS_ACCOUNT_UNRESOLVED`. A wallet with no subaccount at all still bootstraps through
  `settleGaslessDepositNewAccount`.
- The deposit seams resolve their billing account from `account`, which may be a subaccount or a virtual account; a
  virtual account bills its parent. Relaying removes the gas but not the ERC20 approval — the collateral is still pulled
  from the owner's wallet.
- `GASLESS_SESSION_KEY_SELECTORS` is now enumerated explicitly instead of being derived as "every relayable selector
  except `grantDelegation`". It was documented as resistant to silent widening but was not: each of the six new writes
  would have joined it automatically. All six stay owner-signed — they relay without gas, but creating, deleting and
  renaming accounts, moving the owner's collateral, and force-closing are not things a bounded session key does
  unattended. The membership is now asserted by test.
