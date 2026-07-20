---
"@symmio/trading-core": patch
---

Accept the zero address as an affiliate in `createConfig`.

`createConfig` no longer rejects `addresses.affiliatesAddress === zeroAddress`; it now enforces only that the field is **present** for every supported chain. The zero address is on-chain's **no-affiliate sentinel** — the trade still opens, you just receive no share of the trading fee — so it is a valid (if attribution-free) value and a useful testing placeholder. What actually reverts on-chain is a non-zero **unregistered** affiliate (`PartyAFacet: Invalid affiliate`), which `createConfig` cannot detect. `AFFILIATE_ADDRESS_REQUIRED` still throws when the field is missing entirely, so a trade can never silently fall back to the SDK's built-in default affiliate and lose attribution. Use a **registered** affiliate to earn your fee share.
