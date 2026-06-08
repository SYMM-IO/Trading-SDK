import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";

/** On-chain market metadata returned by SYMMIO core `getSymbols`. */
export interface OnchainContractMarket {
  /** SYMMIO symbol id. */
  symbolId: bigint;
  /** Contract-level market name, such as `BTCUSDT`. */
  name: string;
  /** Whether the market is currently valid for trading. */
  isValid: boolean;
  /** Minimum acceptable quote value in raw 18-decimal units. */
  minAcceptableQuoteValue: bigint;
  /** Minimum acceptable liquidation-fee portion in raw 18-decimal units. */
  minAcceptablePortionLF: bigint;
  /** Trading fee rate in raw 18-decimal fixed point units. */
  tradingFee: bigint;
  /** Maximum leverage in raw 18-decimal fixed point units. */
  maxLeverage: bigint;
  /** Funding-rate epoch duration in seconds. */
  fundingRateEpochDuration: bigint;
  /** Funding-rate window time in seconds. */
  fundingRateWindowTime: bigint;
}

/**
 * Parameters for {@link getOnchainContractMarkets}.
 */
export type GetOnchainContractMarketsParameters = Compute<
  ChainIdParameter & {
    /** Start offset passed to SYMMIO core `getSymbols`. */
    start: bigint | number;
    /** Page size passed to SYMMIO core `getSymbols`. */
    size: bigint | number;
  }
>;

/** Return type of {@link getOnchainContractMarkets}: on-chain contract markets. */
export type GetOnchainContractMarketsReturnType = readonly OnchainContractMarket[];

/**
 * Read paginated on-chain contract markets from SYMMIO core.
 *
 * This calls the SYMMIO core `getSymbols(start, size)` view and returns its
 * named symbol fields.
 *
 * @param config - The SDK config.
 * @param parameters - Start offset, page size, and optional chain id.
 * @returns A page of on-chain contract markets.
 * @throws {SymmError} when the chain is not supported.
 * @throws Viem's `ContractFunctionExecutionError` and friends for on-chain failures.
 *
 * @example
 * ```ts
 * const markets = await getOnchainContractMarkets(config, { start: 0, size: 100 });
 * console.log(markets[0]?.name);
 * ```
 */
export async function getOnchainContractMarkets(
  config: Config,
  parameters: GetOnchainContractMarketsParameters,
): Promise<GetOnchainContractMarketsReturnType> {
  const { chainId, start, size } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });

  return client.readContract({
    address: addresses.symmioAddress,
    abi: symmioAbi,
    functionName: "getSymbols",
    args: [BigInt(start), BigInt(size)],
  });
}
