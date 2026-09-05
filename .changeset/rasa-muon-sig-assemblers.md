---
"@symmio/trading-core": major
"@symmio/trading-react": major
---

Add the contract-ready Muon signature assemblers the Rasa (majors) flows need, and let signed InstantLayer operations delegate a calldata region to a solver.

Muon itself is deployment-agnostic — one `symmio` app on one shared gateway set serves both deployments, and the per-deployment input is the `symmio` request param (the chain's diamond), which the SDK already resolves per chain. What was missing was everything downstream of the attestation.

**New in `@symmio/trading-core`**

- `getSendQuoteUpnlSig` — assembles a Muon `uPnl_A_withSymbolPrice` attestation into `SingleUpnlAndPriceSig`, the `upnlSig` argument of `sendQuoteWithAffiliateAndData`. Solvers that enforce Muon verification require a live one.
- `getForceClosePriceSig` — assembles a Muon `priceRange` attestation into `HighLowPriceSig`, which `forceClosePosition` verifies.
- `SingleUpnlAndPriceSig` and `HighLowPriceSig` types, mirrored field-for-field from perps-core v0.8.5 `MuonStorage.sol`. Note `HighLowPriceSig.upnlPartyB` precedes `upnlPartyA`.
- `sendQuoteUpnlSigFlexRange(callData)` — locates the encoded `upnlSig` region so it can be delegated to a solver. Argument indices are derived from the shipped ABI, not hardcoded.
- `buildSignedOperation` now accepts `flexFields` and `maxUses` (defaults unchanged: `[]` and `1n`).

**`instantOpen` now dispatches per solver kind**

Enigma (lowcap) and Rasa (majors) open positions differently, and `instantOpen` now has one adapter per kind instead of assuming Enigma's shape for both:

- **Enigma** — unchanged two-operation flow (`addMarginToNextVA` + `sendQuote`), still requiring `margin`, now additionally delegating the quote's `upnlSig` region to the solver via a `FlexField`.
- **Rasa** — a single `sendQuote` operation signed for the sub-account (cross-margin, no virtual account, no `addMargin`), carrying a live Muon signature, posted to `/instant_trade/open` via the new `sendRasaInstantOpen`.

`InstantOpenParameters` gains an optional `solverId` and makes `margin` optional (required by Enigma at runtime, ignored by Rasa). `InstantOpenReturnType` becomes a union discriminated on `kind` — `EnigmaInstantOpenResult | RasaInstantOpenResult`, the latter carrying the normalized `rfq`. Both are generic over the solver kind, so a literal `solverId` narrows them; `useInstantOpen` threads the same generic.

**New in `@symmio/trading-react`**

- `useSendQuoteUpnlSig` and `useForceClosePriceSig`, both mutations like the other Muon hooks.

**Behavior changes**

- `InstantOpenReturnType` now carries a required `kind` discriminant. Code that constructs or exhaustively destructures that value needs updating; code that only reads `success` / `tempQuoteId` / `partyBmm` is unaffected.

- `getFakeSendQuoteMuonSignature` now emits a 32-byte zero `reqId` instead of `0x`, so the encoded `upnlSig` region is the size a solver's flex fill expects. This changes the bytes of the placeholder quote calldata (and therefore its EIP-712 struct hash) for lowcap opens.
- `getDeallocateUpnlSig` now throws `MUON_SIG_MALFORMED` (was `MUON_UPNL_SIG_MALFORMED`) when the attestation is missing its Schnorr share, and `MUON_FIELD_MALFORMED` rather than a raw `TypeError` when `uPnl` is absent. Both now come from the shared envelope helper used by all three assemblers.
