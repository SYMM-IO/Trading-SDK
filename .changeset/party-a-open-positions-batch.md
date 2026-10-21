---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Add `getPartyAOpenPositionsBatch` (query options + `usePartyAOpenPositionsBatch`): read the open positions of many partyAs in chunked multicalls, one result per account (per-account failures isolated, per-account `start` paging with `hasMore`), with an optional per-account liquidation flag. Add `isPartyALiquidated` (query options + `useIsPartyALiquidated`): whether a partyA's liquidation is in progress.
