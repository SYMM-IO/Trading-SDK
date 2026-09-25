import {
  accumulateOrderbook,
  calculatePriceImpact,
  createBinanceCandleSource,
  createBinanceOrderbookSource,
  getCandlesQueryOptions,
  getEstimatedPriceQueryOptions,
  getFundingInfoQueryOptions,
  getMarketInfoQueryOptions,
  getOrderbookDepthWithin,
  getOrderbookQueryOptions,
  getOrderbookSpread,
  PositionType,
  resolutionToMs,
  supportsEstimatedPrice,
  type Candle,
  type CandleResolution,
  type Market,
  type Orderbook,
  type OrderbookDepthLevel,
  type OrderbookDepthSummary,
  type OrderbookResyncReason,
  type OrderbookSpread,
  type SocketStatus,
} from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSdkScope } from "./use-sdk-scope.js";

const CANDLE_SOURCE = createBinanceCandleSource();
const ORDERBOOK_SOURCE = createBinanceOrderbookSource();
const CANDLE_LIMIT = 72;
const ORDERBOOK_LIMIT = 100;
const PROBE_SLIPPAGE = 0.01;

/** Solver map key for funding and market-info endpoints. */
function solverMarketKey(market: Market): string {
  return market.kind === "enigma" ? market.symbol : market.name;
}

function alignedRangeEnd(resolution: CandleResolution): number {
  const interval = resolutionToMs(resolution);
  return Math.floor(Date.now() / interval) * interval + interval;
}

function decimalForRequest(value: number, precision: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const fixed = value.toFixed(Math.max(0, Math.min(18, precision)));
  if (Number(fixed) <= 0) return "";
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

function mergeCandles(history: readonly Candle[], live: readonly Candle[]): Candle[] {
  const byTime = new Map(history.map((candle) => [candle.time, candle]));
  for (const candle of live) byTime.set(candle.time, candle);
  return [...byTime.values()].sort((left, right) => left.time - right.time).slice(-CANDLE_LIMIT);
}

function appendLiveCandle(current: readonly Candle[], next: Candle): Candle[] {
  const candles = [...current];
  const existing = candles.findIndex((candle) => candle.time === next.time);
  if (existing >= 0) candles[existing] = next;
  else candles.push(next);
  return candles.slice(-CANDLE_LIMIT);
}

/** Normalized 24-hour figures across the two solver market-info shapes. */
export interface SelectedMarketStats {
  volume24h: number;
  change24h?: number;
  referencePrice?: number;
  notionalCap?: number;
  lifetimeValue?: number;
}

/** Read-only open-fill probe for one side of the selected market. */
export interface EstimatedFillProbe {
  estimatedPrice?: string;
  impactPercent?: number;
  isLoading: boolean;
  error: unknown;
}

interface UseMarketAnalyticsParameters {
  market: Market;
  markPrice?: string;
  resolution: CandleResolution;
  probeNotional: number;
  depthRows: number;
}

/**
 * Aggregate every read-only analytics surface for one selected market.
 *
 * Chain/solver reads use the SDK query factories. Candles and depth are
 * explicitly reference-exchange data and are enabled only after Binance says
 * it carries the market.
 */
export function useMarketAnalytics({
  market,
  markPrice,
  resolution,
  probeNotional,
  depthRows,
}: UseMarketAnalyticsParameters) {
  const { config, chainId, solverId } = useSdkScope();
  const marketKey = solverMarketKey(market);
  const [rangeEnd, setRangeEnd] = useState(() => alignedRangeEnd(resolution));
  const [liveCandles, setLiveCandles] = useState<Candle[]>([]);
  const [candleStatus, setCandleStatus] = useState<SocketStatus>("closed");
  const [candleStreamError, setCandleStreamError] = useState<unknown>(null);
  const [liveOrderbook, setLiveOrderbook] = useState<Orderbook | null>(null);
  const [orderbookStatus, setOrderbookStatus] = useState<SocketStatus>("closed");
  const [orderbookStreamError, setOrderbookStreamError] = useState<unknown>(null);
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncReason, setResyncReason] = useState<OrderbookResyncReason | null>(null);
  const latestMark = useRef(markPrice);
  const [probeMark, setProbeMark] = useState(markPrice);
  latestMark.current = markPrice;

  useEffect(() => {
    setRangeEnd(alignedRangeEnd(resolution));
    setLiveCandles([]);
  }, [market.name, resolution]);

  useEffect(() => {
    setProbeMark(latestMark.current);
    const timer = setInterval(() => setProbeMark(latestMark.current), 15_000);
    return () => clearInterval(timer);
  }, [market.symbolId]);

  useEffect(() => {
    if (probeMark == null && markPrice != null) setProbeMark(markPrice);
  }, [markPrice, probeMark]);

  const referenceSymbol = useQuery({
    queryKey: ["marketAnalyticsReferenceSymbol", ORDERBOOK_SOURCE.id, market.name],
    queryFn: async () => (await ORDERBOOK_SOURCE.getSymbol(market.name)) ?? null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  const referenceSupported = referenceSymbol.data != null;

  const candleRange = useMemo(() => {
    const interval = resolutionToMs(resolution);
    return { from: rangeEnd - interval * CANDLE_LIMIT, to: rangeEnd };
  }, [rangeEnd, resolution]);

  const candleQuery = useQuery(
    getCandlesQueryOptions(CANDLE_SOURCE, {
      marketName: market.name,
      resolution,
      from: candleRange.from,
      to: candleRange.to,
      limit: CANDLE_LIMIT,
      query: {
        enabled: referenceSupported,
        staleTime: Math.min(resolutionToMs(resolution), 30_000),
        gcTime: 5 * 60_000,
        retry: 1,
      },
    }),
  );
  const refetchCandles = candleQuery.refetch;

  useEffect(() => {
    if (!referenceSupported || !CANDLE_SOURCE.watchCandles) {
      setCandleStatus("closed");
      return;
    }

    setCandleStreamError(null);
    setLiveCandles([]);
    let unwatch: (() => void) | undefined;
    try {
      unwatch = CANDLE_SOURCE.watchCandles({
        marketName: market.name,
        resolution,
        onCandle: (candle) => setLiveCandles((current) => appendLiveCandle(current, candle)),
        onReset: () => {
          setLiveCandles([]);
          void refetchCandles();
        },
        onStatusChange: setCandleStatus,
        onError: setCandleStreamError,
      });
    } catch (error) {
      setCandleStreamError(error);
      setCandleStatus("closed");
    }
    return () => unwatch?.();
  }, [market.name, referenceSupported, refetchCandles, resolution]);

  const orderbookQuery = useQuery(
    getOrderbookQueryOptions(ORDERBOOK_SOURCE, {
      marketName: market.name,
      limit: ORDERBOOK_LIMIT,
      query: {
        enabled: referenceSupported,
        staleTime: 5_000,
        gcTime: 60_000,
        retry: 1,
      },
    }),
  );

  useEffect(() => {
    if (!referenceSupported || !ORDERBOOK_SOURCE.watchOrderbook) {
      setOrderbookStatus("closed");
      return;
    }

    setOrderbookStreamError(null);
    setLiveOrderbook(null);
    setIsResyncing(false);
    setResyncReason(null);
    let unwatch: (() => void) | undefined;
    try {
      unwatch = ORDERBOOK_SOURCE.watchOrderbook({
        marketName: market.name,
        limit: ORDERBOOK_LIMIT,
        levels: Math.max(20, depthRows * 3),
        onOrderbook: (book) => {
          setOrderbookStreamError(null);
          setLiveOrderbook(book);
          setIsResyncing(false);
        },
        onResync: (reason) => {
          setResyncReason(reason);
          setIsResyncing(true);
        },
        onStatusChange: setOrderbookStatus,
        onError: setOrderbookStreamError,
      });
    } catch (error) {
      setOrderbookStreamError(error);
      setOrderbookStatus("closed");
    }
    return () => unwatch?.();
  }, [depthRows, market.name, referenceSupported]);

  const fundingQuery = useQuery(
    getFundingInfoQueryOptions(config, {
      chainId,
      solverId,
      symbols: [marketKey],
      query: { staleTime: 30_000, refetchInterval: 30_000, retry: false },
    }),
  );

  const marketInfoQuery = useQuery(
    getMarketInfoQueryOptions(config, {
      chainId,
      solverId,
      query: { staleTime: 60_000, gcTime: 5 * 60_000, retry: false },
    }),
  );

  const selectedMarketStats = useMemo<SelectedMarketStats | undefined>(() => {
    const info = marketInfoQuery.data;
    if (!info) return undefined;
    const row = info.markets.find(
      (candidate) =>
        candidate.symbol === marketKey || candidate.symbol === market.name || candidate.symbol === market.symbol,
    );
    if (!row) return undefined;
    if (info.kind === "enigma") {
      const enigmaRow = row as (typeof info.markets)[number];
      return {
        volume24h: enigmaRow.tradingVolume,
        lifetimeValue: enigmaRow.lifetimeValue,
      };
    }
    const rasaRow = row as (typeof info.markets)[number];
    return {
      volume24h: rasaRow.tradeVolume,
      change24h: rasaRow.priceChangePercent,
      referencePrice: rasaRow.price,
      notionalCap: rasaRow.notionalCap,
    };
  }, [market.name, market.symbol, marketInfoQuery.data, marketKey]);

  const estimateSupported = supportsEstimatedPrice(config, { chainId, solverId });
  const probe = useMemo(() => {
    const price = Number(probeMark);
    if (!estimateSupported || !Number.isFinite(price) || price <= 0 || probeNotional <= 0) {
      return { quantity: "", longPrice: "", shortPrice: "" };
    }
    return {
      quantity: decimalForRequest(probeNotional / price, market.quantityPrecision),
      longPrice: decimalForRequest(price * (1 + PROBE_SLIPPAGE), market.pricePrecision),
      shortPrice: decimalForRequest(price * (1 - PROBE_SLIPPAGE), market.pricePrecision),
    };
  }, [estimateSupported, market.pricePrecision, market.quantityPrecision, probeMark, probeNotional]);
  const estimateEnabled =
    estimateSupported && probe.quantity.length > 0 && probe.longPrice.length > 0 && probe.shortPrice.length > 0;

  const longEstimateQuery = useQuery(
    getEstimatedPriceQueryOptions(config, {
      chainId,
      solverId,
      symbolId: market.symbolId,
      quantity: probe.quantity,
      positionType: PositionType.LONG,
      entry: "open",
      price: probe.longPrice,
      query: { enabled: estimateEnabled, staleTime: 15_000, retry: false },
    }),
  );
  const shortEstimateQuery = useQuery(
    getEstimatedPriceQueryOptions(config, {
      chainId,
      solverId,
      symbolId: market.symbolId,
      quantity: probe.quantity,
      positionType: PositionType.SHORT,
      entry: "open",
      price: probe.shortPrice,
      query: { enabled: estimateEnabled, staleTime: 15_000, retry: false },
    }),
  );
  const refetchReferenceSymbol = referenceSymbol.refetch;
  const refetchOrderbook = orderbookQuery.refetch;
  const refetchFunding = fundingQuery.refetch;
  const refetchMarketInfo = marketInfoQuery.refetch;
  const refetchLongEstimate = longEstimateQuery.refetch;
  const refetchShortEstimate = shortEstimateQuery.refetch;

  const makeProbe = useCallback(
    (estimatedPrice: string | undefined, isLoading: boolean, error: unknown): EstimatedFillProbe => {
      const validPrice = estimatedPrice && estimatedPrice !== "0" ? estimatedPrice : undefined;
      return {
        estimatedPrice: validPrice,
        impactPercent:
          validPrice && probeMark
            ? calculatePriceImpact({ estimatedPrice: validPrice, referencePrice: probeMark })
            : undefined,
        isLoading,
        error,
      };
    },
    [probeMark],
  );

  const orderbook = liveOrderbook ?? orderbookQuery.data ?? null;
  const orderbookMetrics = useMemo<{
    bids: OrderbookDepthLevel[];
    asks: OrderbookDepthLevel[];
    spread?: OrderbookSpread;
    depth?: OrderbookDepthSummary;
    maxTotal: number;
  }>(() => {
    if (!orderbook) return { bids: [], asks: [], maxTotal: 0 };
    const bids = accumulateOrderbook(orderbook.bids).slice(0, depthRows);
    const asks = accumulateOrderbook(orderbook.asks).slice(0, depthRows);
    return {
      bids,
      asks,
      spread: getOrderbookSpread(orderbook),
      depth: getOrderbookDepthWithin(orderbook, 0.01),
      maxTotal: Math.max(bids.at(-1)?.total ?? 0, asks.at(-1)?.total ?? 0),
    };
  }, [depthRows, orderbook]);

  const refresh = useCallback(() => {
    setRangeEnd(alignedRangeEnd(resolution));
    setProbeMark(latestMark.current);
    void Promise.all([
      refetchReferenceSymbol(),
      refetchCandles(),
      refetchOrderbook(),
      refetchFunding(),
      refetchMarketInfo(),
      ...(estimateSupported ? [refetchLongEstimate(), refetchShortEstimate()] : []),
    ]);
  }, [
    estimateSupported,
    refetchCandles,
    refetchFunding,
    refetchLongEstimate,
    refetchMarketInfo,
    refetchOrderbook,
    refetchReferenceSymbol,
    refetchShortEstimate,
    resolution,
  ]);

  return {
    reference: {
      supported: referenceSupported,
      isLoading: referenceSymbol.isLoading,
      error: referenceSymbol.error,
      symbol: referenceSymbol.data,
    },
    candles: mergeCandles(candleQuery.data?.candles ?? [], liveCandles),
    candlesLoading: referenceSupported && candleQuery.isLoading,
    candlesError: candleQuery.error ?? candleStreamError,
    candleStatus,
    orderbook: orderbookMetrics,
    orderbookLoading: referenceSupported && orderbook == null && orderbookStreamError == null,
    orderbookError: orderbookQuery.error ?? orderbookStreamError,
    orderbookStatus,
    isResyncing,
    resyncReason,
    funding: fundingQuery.data?.find((row) => row.symbol === marketKey),
    fundingLoading: fundingQuery.isLoading,
    fundingError: fundingQuery.error,
    marketStats: selectedMarketStats,
    marketStatsLoading: marketInfoQuery.isLoading,
    marketStatsError: marketInfoQuery.error,
    estimateSupported,
    probeQuantity: probe.quantity,
    longEstimate: makeProbe(
      longEstimateQuery.data?.estimatedPrice,
      longEstimateQuery.isLoading || longEstimateQuery.isFetching,
      longEstimateQuery.error,
    ),
    shortEstimate: makeProbe(
      shortEstimateQuery.data?.estimatedPrice,
      shortEstimateQuery.isLoading || shortEstimateQuery.isFetching,
      shortEstimateQuery.error,
    ),
    refresh,
  };
}

/** Inferred aggregate returned by {@link useMarketAnalytics}. */
export type MarketAnalyticsResult = ReturnType<typeof useMarketAnalytics>;
