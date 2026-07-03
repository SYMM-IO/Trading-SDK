<!-- Internal note for SDK maintainers. Not a public doc. -->

# Muon services — verification debt

All 9 documented `symmio` Muon methods are implemented as SDK slices
(`packages/trading-core/src/muon/<method>/`, react hooks in `packages/trading-react/src/muon/`,
web forms in `apps/web/src/features/muon/`). Coverage is complete, but **only
`uPnl_A`'s exact response nesting is verified** (against Vibe-ui's parser).

## Verified against the live gateway (2026-06-13)

- **Response envelope is identical across methods** — `result.{reqId, nodeSignature,
signatures[0].{owner,signature}}` and `result.data.{timestamp, init.nonceAddress,
result}`. So `toMuonAttestationBase` is correct for every method.
- **Array param format = JSON-array string.** `quoteIds` is sent as `params[quoteIds]=[10,11]`
  (a string the gateway JSON-parses). Bracketed/repeated array keys fail input
  validation (`"quoteIds" must be a string`). Handled by `toMuonArrayParam` in `client.ts`;
  used by `price` + `settle_upnl`. This was the cause of the `quoteIds.map is not a function` error.
- **`price`** returns `data.result.{chainId, quoteIds, symmio, latestBlockNumber, symbols, prices}`
  (no `markPrices`/`maxLeverages` observed).
- **`settle_upnl`** returns `data.result.{…, quoteSettlementData:[[quoteId,price,…]], uPnlA, …}`.

## Still best-effort (`TODO(muon-verify)`)

- **Response field nesting** for the 6 methods not yet checked live (`partyA_overview`,
  `uPnl_A_withSymbolPrice`, `uPnl_B`, `uPnl`, `uPnlWithSymbolPrice`, `priceRange`).
- **Wire method casing** for those 6 (docs show e.g. `uPnL_A`; code uses `uPnl_A` per Vibe-ui).
- **`settle_upnl.quoteSettlementData`** is intentionally not typed yet.

To verify: call a gateway with a real `partyA`/`partyB`/`quoteIds`, diff the JSON
against each slice's normalizer + test RAW fixture, and tighten the optional
fields. The 4 endpoint-less contract structs (DeferredLiquidationSig,
UnifiedSettlementSig, PairUpnlAndPricesSig, SingleUpnlWithPendingBalanceSig) are
out of scope.
