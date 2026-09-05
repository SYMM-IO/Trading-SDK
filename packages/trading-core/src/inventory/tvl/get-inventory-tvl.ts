import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveInventoryService } from "../resolve-inventory";
import { getSystemTvlApiV1MarketsTvlAggregateGet } from "../types/generated/inventory-service";

/** Parameters for {@link getInventoryTvl}. */
export type GetInventoryTvlParameters = Compute<ChainIdParameter>;

/**
 * Return type of {@link getInventoryTvl}: aggregate custodial TVL as a `bigint`
 * at `INVENTORY_VALUE_DECIMALS` (18).
 */
export type GetInventoryTvlReturnType = bigint;

/**
 * Read the system-wide custodial TVL from the chain's inventory service — the
 * total value the inventory holds across every trading market.
 *
 * This is the figure a pools page shows as its headline TVL. It is **not** the
 * sum of the catalogue's per-pool `tvl` values: the catalogue only covers listed
 * markets, while this covers the whole custodial system.
 *
 * Returned as a `bigint` at 18 decimals; format with
 * `formatUnits(value, INVENTORY_VALUE_DECIMALS)`.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id.
 * @returns Aggregate TVL, 18-decimal fixed point.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} `INVENTORY_NOT_CONFIGURED` when the chain has no inventory service.
 *
 * @example
 * ```ts
 * const tvl = await getInventoryTvl(config);
 * formatUnits(tvl, INVENTORY_VALUE_DECIMALS).toFixed(2); // "630232.53"
 * ```
 */
export async function getInventoryTvl(
  config: Config,
  parameters: GetInventoryTvlParameters = {},
): Promise<GetInventoryTvlReturnType> {
  const { url: baseURL } = resolveInventoryService(config, parameters.chainId);

  try {
    const response = await getSystemTvlApiV1MarketsTvlAggregateGet({ baseURL });
    return toInventoryTvl(response.data.tvl);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_INVENTORY_TVL_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_INVENTORY_TVL_FAILED",
      `Failed to fetch inventory TVL: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}

/**
 * Parse the inventory service's 18-decimal TVL string into a `bigint`.
 *
 * Defaults to `0n` for an absent or unparseable value rather than throwing: TVL
 * is a headline figure, and a malformed response should not take down a page.
 * A fractional tail is truncated toward zero, since `BigInt()` would throw on it.
 *
 * @param raw - The service's `tvl` string.
 * @returns The value as an 18-decimal `bigint`.
 */
export function toInventoryTvl(raw: string | null | undefined): bigint {
  if (raw === null || raw === undefined) return 0n;

  const match = /^([+-]?)(\d*)(?:\.\d*)?$/.exec(raw.trim());
  const digits = match?.[2];
  if (digits === undefined || digits === "") return 0n;

  const magnitude = BigInt(digits);
  return match?.[1] === "-" ? -magnitude : magnitude;
}
