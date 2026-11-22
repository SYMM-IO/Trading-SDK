---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add shared Enigma notification-envelope subscriptions and a React lifecycle hook. Raw watchers share explicitly routed events. Position watchers keep their account/channel scope across subscription changes.

Expose exact solver minimum collateral and pending-open creation time, optional cancellation for info/search, and an optional pending-open application header.

Expose normalized listing deposit and pool-creation events in core and React.

For consumers migrating bearer-authenticated conditional orders, the signed TP/SL flow uses the wallet or session key directly. Both the nonce/sign-in challenge and the bearer-token exchange can be dropped for these operations. Use `setQuoteTpSl` for creation, `deleteQuoteTpSl` for cancellation, and `searchTpSlOrders` for conditional-order reads. Verify history filters and pagination against the records the consumer displays. The generated handler specification exposes locked collateral under v4; equivalence with the application's bearer-authenticated v5 balance read has not been established. Verify that contract before migrating the balance calculation.
