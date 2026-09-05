import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveInventoryService } from "../resolve-inventory";
import type { InventoryTvlPoint } from "../types";
import { getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet } from "../types/generated/inventory-service";
import { toInventoryTvlPoint } from "./to-inventory-tvl-point";

/** Parameters for {@link getInventoryTvlHistory}. */
export type GetInventoryTvlHistoryParameters = Compute<
  ChainIdParameter & {
    /**
     * The market's symbol address — the token contract address the inventory
     * service files a market's holdings under. This is the same id a
     * `ListingMarket` carries as `contractAddress`. Required.
     */
    symbolAddress: string;
  }
>;

/**
 * Return type of {@link getInventoryTvlHistory}: one point per snapshot, in the
 * order the service returns them (oldest first).
 */
export type GetInventoryTvlHistoryReturnType = InventoryTvlPoint[];

/**
 * Read one market's custodial TVL over time from the chain's inventory service —
 * the series behind a pool page's TVL chart.
 *
 * This is the per-market twin of {@link getInventoryTvl}, which reports the
 * whole custodial system as a single figure. Each point's `tvl` is a `bigint` at
 * `INVENTORY_VALUE_DECIMALS` (18) and `timestamp` is unix **seconds**.
 *
 * The endpoint is not deployed on every environment yet — a chain whose
 * inventory service does not serve it answers `404`, which surfaces as a
 * {@link SymmApiError}. Treat an error here as "no chart", not as a broken page.
 *
 * @param config - The SDK config.
 * @param parameters - The market's `symbolAddress` plus an optional chain id.
 * @returns One {@link InventoryTvlPoint} per snapshot.
 * @throws {SymmApiError} when the API request fails, including the `404` on an environment without the route.
 * @throws {SymmError} `INVENTORY_NOT_CONFIGURED` when the chain has no inventory service.
 *
 * @example
 * ```ts
 * const history = await getInventoryTvlHistory(config, { symbolAddress: "0x1234…" });
 * const latest = history.at(-1);
 * formatUnits(latest?.tvl ?? 0n, INVENTORY_VALUE_DECIMALS).toFixed(2); // "177.78"
 * ```
 */
export async function getInventoryTvlHistory(
  config: Config,
  parameters: GetInventoryTvlHistoryParameters,
): Promise<GetInventoryTvlHistoryReturnType> {
  const { url: baseURL } = resolveInventoryService(config, parameters.chainId);

  try {
    const response = await getMarketTvlHistoryApiV1MarketsSymbolAddressTvlHistoryGet(parameters.symbolAddress, {
      baseURL,
    });
    return (response.data ?? []).map(toInventoryTvlPoint);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_INVENTORY_TVL_HISTORY_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_INVENTORY_TVL_HISTORY_FAILED",
      `Failed to fetch inventory TVL history: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
