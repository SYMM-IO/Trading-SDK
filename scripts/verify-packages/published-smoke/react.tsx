/**
 * Resolves `@symmio/trading-react`'s root entry and all eleven named subpath exports
 * under `moduleResolution: nodenext`, and exercises the React types via `react-jsx`.
 * These subpaths are the ones that previously shipped a `.d.ts` with no `.js`
 * twin, so this file is the regression guard for that defect.
 */
import * as react from "@symmio/trading-react";
import * as accountLayer from "@symmio/trading-react/account-layer";
import * as candles from "@symmio/trading-react/candles";
import * as errors from "@symmio/trading-react/errors";
import * as fees from "@symmio/trading-react/fees";
import * as instantLayer from "@symmio/trading-react/instant-layer";
import * as inventory from "@symmio/trading-react/inventory";
import * as markets from "@symmio/trading-react/markets";
import * as orderbook from "@symmio/trading-react/orderbook";
import * as pools from "@symmio/trading-react/pools";
import * as priceService from "@symmio/trading-react/price-service";
import * as provider from "@symmio/trading-react/provider";
import * as transactions from "@symmio/trading-react/transactions";
import * as wallet from "@symmio/trading-react/wallet";

void [
  react,
  provider,
  accountLayer,
  instantLayer,
  wallet,
  errors,
  transactions,
  markets,
  fees,
  priceService,
  candles,
  orderbook,
  inventory,
  pools,
];
