---
"@symmio/trading-core": major
"@symmio/trading-react": major
---

BREAKING: Enigma getMarketInfo/useMarketInfo rows now expose symbolId instead of ticker symbol and read /market-info. Enigma getFundingInfo/useFundingInfo similarly read /funding-info and replace symbols:string[] with symbolIds:number[]. Rasa retains /get_funding_info, symbols:string[] and ticker-based rows. Funding rows now carry a kind discriminant; literal solverId narrows actions, queries and hooks. Join IDs with getSymbols for labels; select an individual market from the shared market-info query. Rasa market-info remains unchanged. Duplicate tickers now remain distinct markets.

Funding ID filters use repeated, unbracketed `symbol_ids` query parameters so the solver applies single- and multiple-market filters correctly.
