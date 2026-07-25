---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add the affiliate registration API.

`@symmio/trading-core` gains account-layer actions `requestToRegisterAffiliate`, `cancelRegistration`, `getAffiliateState`, and `generateAccountManagerAddress`, together with their `simulate*` variants, query option factories, and types. `@symmio/trading-react` wraps them as `useRequestToRegisterAffiliate`, `useCancelRegistration`, `useAffiliateState`, and `useGeneratedAccountManagerAddress`.

Also clarifies the affiliate config contract: `createConfig` still throws `AFFILIATE_ADDRESS_REQUIRED` only when `affiliatesAddress` is missing, and the error message and JSDoc now spell out that the zero address is a valid no-affiliate placeholder (trades open, no fee share). Deposit docs now state that the instant flow funds via `deposit` alone (available balance), while `depositAndAllocate` targets the classic pool.
