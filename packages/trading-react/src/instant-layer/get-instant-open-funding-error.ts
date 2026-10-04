import { validateInstantOpenBalanceFunding } from "@symmio/trading-core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";

/** Run core's synchronous funding check before enabling dependent React queries. */
export function getInstantOpenFundingError(
  parameters: Parameters<typeof validateInstantOpenBalanceFunding>[0],
): SymmioRequestError | undefined {
  try {
    validateInstantOpenBalanceFunding(parameters);
    return undefined;
  } catch (error) {
    return normalizeSymmError(error);
  }
}
