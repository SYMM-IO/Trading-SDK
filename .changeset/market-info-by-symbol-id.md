---
"@symmio/trading-core": major
"@symmio/trading-react": major
---

BREAKING: Enigma getMarketInfo/useMarketInfo rows now expose symbolId instead of ticker symbol and read /market-info. getFundingInfo/useFundingInfo similarly read /funding-info and replace symbols:string[] with symbolIds:number[]. Join IDs with getSymbols for labels; select an individual market from the shared market-info query. Rasa market-info remains unchanged. Duplicate tickers now remain distinct markets.
