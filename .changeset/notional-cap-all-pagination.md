---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

Fix `getNotionalCapAll` to fetch every 100-row page and sum page-only totals. Add `getNotionalCapPage`, its query options and `useNotionalCapPage` for explicit pagination. Numeric dollar amounts and missing-number defaults remain compatible.
