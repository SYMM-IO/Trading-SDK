---
"@symmio/trading-core": minor
"@symmio/trading-react": minor
---

**Virtual-account reads.**

- **`getVirtualAccountsOfSubAccount` / `useVirtualAccountsOfSubAccount`** list a subaccount's virtual accounts with their details (market, parent, isolation type) in one AccountLayer call, instead of one call per VA.
- **`getVirtualAccountsCountOfSubAccount` / `useVirtualAccountsCountOfSubAccount`** read how many there are, to page past the default limit of 200.
- **`getActiveVirtualAccountByKey` / `useActiveVirtualAccountByKey`** read the VA active for an isolation key (`getActiveVAByKey`), returning `null` instead of the zero address when none is active.

The existing virtual-account reads (`getVirtualAccount`, `getVirtualAccountsAddressesOfSubAccount`, `getSubAccountVirtualNonce`) are now documented too.
