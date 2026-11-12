---
"@symmio/trading-core": patch
"@symmio/trading-react": patch
---

**Gasless submit fixes.**

- **A refused replay stays unconfirmed.** `resubmitGaslessRequest` reports any refusal of the replay — a service verdict, a `409`, a `429` — as `GASLESS_SUBMIT_UNCONFIRMED` with the answer as its `cause`: it describes the replay only, while the original attempt may have executed. It is never grounds for a wallet-paid retry.
- **Transparent relays send the billing account.** A relayed write now sends its billing sub-account as `accountId`, so the request is tracked under the account it bills.
- **`useCreateSubAccounts` refreshes every owner's account lists.** The signer may be a session key or an embedded wallet unrelated to wagmi's connected address, so the account-list, address-list and count queries are invalidated for every owner.
