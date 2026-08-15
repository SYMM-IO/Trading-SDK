import type { SymmioPriceServiceConfig, SymmioPriceServiceType } from "../core/chains/types";
import { SymmError } from "../shared/errors/symm-error";

/**
 * Throw when the resolved price service cannot serve a provider-exclusive
 * action — the price-axis mirror of `assertSolverKind`.
 *
 * Without it, a provider-specific action reaching the wrong host either 404s
 * with a confusing vendor message or, for the WebSocket watchers, fails
 * *silently*: the socket connects, the other provider's frames parse to nothing,
 * and the feed reports `open` while delivering zero ticks forever.
 *
 * @param priceService - The resolved price service (see `resolvePriceService`).
 * @param type - The provider this action requires.
 * @param action - Action name, for the error message.
 * @throws {SymmError} `UNSUPPORTED_BY_PRICE_SERVICE` when the provider differs.
 *
 * @internal
 */
export function assertPriceServiceProvider(
  priceService: SymmioPriceServiceConfig,
  type: SymmioPriceServiceType,
  action: string,
): void {
  if (priceService.type !== type) {
    throw new SymmError(
      "config",
      "UNSUPPORTED_BY_PRICE_SERVICE",
      `${action}: the resolved price service is "${priceService.type}", but this action requires a "${type}" price service.`,
    );
  }
}
