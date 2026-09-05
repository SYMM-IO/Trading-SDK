import type { SolverId } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { getMarkPrices } from "../../../price-service/get-mark-prices/get-mark-prices";
import { resolvePriceService } from "../../../price-service/resolve-price-service";
import { SymmError } from "../../../shared/errors/symm-error";

/**
 * Parameters for {@link resolveMarkPrice}.
 */
export interface ResolveMarkPriceParameters {
  chainId?: number;
  /**
   * Solver the trade targets. Its configured price provider supplies the mark.
   * **Must match the solver the trade is sent to** — the resolved price is
   * signed into the EIP-712 payload. Defaults to the chain's `defaultSolverId`.
   */
  solverId?: SolverId;
  marketName: string;
  markPrice?: string;
}

/**
 * Resolve a mark price for `marketName`. Returns the caller-supplied value when
 * present; otherwise reads the price provider configured for the resolved solver
 * — Enigma's lowcap service for lowcap solvers, Binance USD-M Futures for
 * majors.
 *
 * Shared by the instant-open and instant-close wizards, so the resolved value is
 * signed into an EIP-712 operation. Getting the provider wrong here is a wrong
 * price on-chain, not a display bug — which is why `solverId` must reach this
 * function and must match the solver the trade is sent to.
 *
 * @throws {SymmError} `RESOLVE_MARK_PRICE_NOT_FOUND` when the provider omits the
 *   requested name from its response.
 */
export async function resolveMarkPrice(config: Config, parameters: ResolveMarkPriceParameters): Promise<string> {
  if (parameters.markPrice !== undefined) return parameters.markPrice;

  const target = { chainId: parameters.chainId, solverId: parameters.solverId };
  const wanted = parameters.marketName;
  const ticks = await getMarkPrices(config, { ...target, names: [wanted] });

  // Exact match first so the caller's spelling wins; the case-insensitive pass
  // only covers a provider that canonicalizes casing differently.
  const tick =
    ticks.find((entry) => entry.name === wanted) ??
    ticks.find((entry) => entry.name.toUpperCase() === wanted.toUpperCase());

  if (!tick) {
    const { type } = resolvePriceService(config, target);
    // The single most likely failure while majors migrate onto Binance: a lowcap
    // market name sent to a provider that only serves plain exchange symbols.
    const hint =
      type === "binance" && wanted.includes("::")
        ? ` "${wanted}" looks like a lowcap market name; Binance USD-M Futures serves plain symbols such as "BTCUSDT".`
        : "";
    throw new SymmError(
      "api",
      "RESOLVE_MARK_PRICE_NOT_FOUND",
      `Mark price not returned by the "${type}" price service for market "${wanted}".${hint}`,
    );
  }
  return tick.markPrice;
}
