import type { PoolDexPair } from "./dex";

/** Independent provider results for one token; callers control refresh cadence. */
export interface PoolEnrichmentSources {
  /** Existing detail enrichment, when only refreshing fallback providers. */
  current?: PoolDexEnrichment;
  pairs?: readonly PoolDexPair[];
  metadataDexId?: string;
  pumpComplete?: boolean;
  jupiterPrice?: number;
  metadataPrice?: string;
  geckoMarketCap?: number;
  markPrice?: number;
}

/** Unformatted DEX data selected for one token. */
export interface PoolDexEnrichment {
  tokenImage?: string;
  dexId?: string;
  url?: string;
  priceUsd?: string;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  liquidity?: number;
  fdv?: number;
}

/** Resolve image, DEX identity, price and market-cap fallbacks without changing provider request cadence. */
export function selectPoolEnrichment(sources: PoolEnrichmentSources) {
  const pairs = sources.pairs;
  const imagePair = pairs?.reduce<PoolDexPair | undefined>(
    (best, pair) => (!best || (pair.info?.imageUrl && !best.info?.imageUrl) ? pair : best),
    undefined,
  );
  const pricePair =
    pairs
      ?.filter((pair) => pair.priceUsd != null)
      .reduce<
        PoolDexPair | undefined
      >((best, pair) => (!best || (pair.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? pair : best), undefined) ??
    imagePair;
  const dexId =
    (sources.current?.dexId || undefined) ??
    imagePair?.dexId ??
    sources.metadataDexId ??
    (sources.pumpComplete == null ? undefined : sources.pumpComplete ? "pumpswap" : "pumpfun");
  const fallback = sources.jupiterPrice ?? sources.metadataPrice;
  const priceUsd =
    sources.current?.priceUsd ?? pricePair?.priceUsd ?? (fallback == null ? undefined : String(fallback));
  const dexScreener = imagePair
    ? {
        tokenImage: imagePair.info?.imageUrl ?? "",
        dexId,
        url: pricePair?.url,
        priceUsd,
        priceChange24h: pricePair?.priceChange?.h24,
        marketCap: pricePair?.marketCap,
        volume24h: pricePair?.volume?.h24,
        liquidity: pricePair?.liquidity?.usd,
        fdv: pricePair?.fdv,
      }
    : dexId != null || priceUsd != null
      ? { dexId, priceUsd }
      : undefined;
  return {
    ...(sources.current || dexScreener ? { dexScreener: { ...sources.current, ...dexScreener, dexId, priceUsd } } : {}),
    ...(sources.markPrice != null ? { markPriceUsd: sources.markPrice } : {}),
    ...(sources.geckoMarketCap != null && Number.isFinite(sources.geckoMarketCap) && sources.geckoMarketCap > 0
      ? { marketCapUsd: sources.geckoMarketCap }
      : {}),
  };
}

/** Source eligibility. Gecko reads start only after DEX has answered, including an empty successful result. */
export function getPoolEnrichmentNeeds(input: {
  isSolana: boolean;
  dexLoaded: boolean;
  pairs?: readonly PoolDexPair[];
  metadataDexId?: string;
  geckoSupported: boolean;
}) {
  return {
    jupiter: input.isSolana && !input.pairs?.some((pair) => pair.priceUsd != null),
    pump: input.isSolana && !input.pairs?.some((pair) => pair.dexId) && !input.metadataDexId,
    gecko: input.dexLoaded && input.geckoSupported && !input.pairs?.some((pair) => pair.marketCap != null),
  };
}

/** Detail reads prefer the most liquid priced pair, then the first pair, with the first available image. */
export function selectPoolDetailDexData(pairs: readonly PoolDexPair[]): PoolDexEnrichment | undefined {
  const pair =
    pairs
      .filter((item) => item.priceUsd != null)
      .reduce<
        PoolDexPair | undefined
      >((best, item) => (!best || (item.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? item : best), undefined) ??
    pairs[0];
  if (!pair) return undefined;
  return {
    tokenImage: pairs.reduce<string | undefined>((image, item) => image ?? item.info?.imageUrl, undefined),
    dexId: pair.dexId,
    url: pair.url,
    priceUsd: pair.priceUsd,
    priceChange24h: pair.priceChange?.h24,
    marketCap: pair.marketCap,
    volume24h: pair.volume?.h24,
    liquidity: pair.liquidity?.usd,
    fdv: pair.fdv,
  };
}

/** Token-validation preview: sum pool liquidity, but select token-level cap and price from the deepest pair. */
export function getPoolTokenDexStats(pairs: readonly PoolDexPair[]) {
  const deepest = pairs.reduce<PoolDexPair | undefined>(
    (best, item) => (!best || (item.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? item : best),
    undefined,
  );
  const price = deepest?.priceUsd ? Number(deepest.priceUsd) : NaN;
  return {
    totalLiquidity: pairs.reduce((total, pair) => total + (pair.liquidity?.usd || 0), 0),
    totalMarketCap: deepest?.marketCap ?? 0,
    imageUrl: pairs.reduce<string | undefined>((image, pair) => image ?? pair.info?.imageUrl, undefined),
    priceUsd: Number.isFinite(price) && price > 0 ? price : undefined,
    priceChange24h: deepest?.priceChange?.h24,
    dexScreenerUrl: deepest?.url,
    dexId: deepest?.dexId?.toLowerCase(),
  };
}
