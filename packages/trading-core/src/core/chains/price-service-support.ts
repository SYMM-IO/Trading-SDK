import { SymmError } from "../../shared/errors/symm-error";
import { SUPPORTED_PRICE_SERVICE_TYPES } from "./types";

/**
 * Throw when a configured price service's `type` is not one the SDK ships a
 * client for — not in {@link SUPPORTED_PRICE_SERVICE_TYPES}, the single source
 * the `SymmioPriceServiceType` union is derived from. Called by `createConfig`
 * for the chain-level block **and** every solver-nested override, so an
 * unsupported provider fails fast at config-build time rather than at the first
 * read that would point one provider's client at another's host.
 *
 * @param chainId - Chain the price service is configured on, for the message.
 * @param type - The configured `priceService.type`, possibly from untyped JSON.
 * @param solverId - Present when validating a solver-nested override, so the
 *   message can point at the exact block.
 * @throws {SymmError} `UNSUPPORTED_PRICE_SERVICE_TYPE` when the type is unknown.
 *
 * @internal
 */
export function assertSupportedPriceServiceType(chainId: number, type: string, solverId?: string): void {
  // The union types the field, but the runtime config may come from untyped
  // JSON, so treat a miss as possible.
  if ((SUPPORTED_PRICE_SERVICE_TYPES as readonly string[]).includes(type)) return;

  const where = solverId ? `solver "${solverId}" on chain ${chainId}` : `chain ${chainId}`;
  throw new SymmError(
    "config",
    "UNSUPPORTED_PRICE_SERVICE_TYPE",
    `createConfig: price-service type "${type}" for ${where} is not supported. Supported types: ${SUPPORTED_PRICE_SERVICE_TYPES.join(", ")}. Ship its adapter before registering it.`,
  );
}
