import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import {
  checkInWhiteListCheckInWhitelistAddressMultiAccountAddressGet,
  type MultiAccountEnum,
} from "../types/generated/rasa-solver";

/** Parameters for {@link checkSolverWhitelist}. */
export type CheckSolverWhitelistParameters = Compute<
  ReadSolverParameter & {
    /** Address to check against the solver's whitelist. */
    address: Address;
    /** MultiAccount contract address; defaults to the chain's `accountLayerAddress`. */
    multiAccountAddress?: Address;
  }
>;

/** Return type of {@link checkSolverWhitelist} — `true` when the address is whitelisted. */
export type CheckSolverWhitelistReturnType = boolean;

/**
 * Check whether an address is on the solver's whitelist via the Rasa-only
 * `/check_in-whitelist` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - Address, optional MultiAccount override, optional chain/solver.
 * @returns `true` when whitelisted.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function checkSolverWhitelist(
  config: Config,
  parameters: CheckSolverWhitelistParameters,
): Promise<CheckSolverWhitelistReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "checkSolverWhitelist");
  const multiAccountAddress =
    parameters.multiAccountAddress ?? config.getChainConfig(parameters.chainId).addresses.accountLayerAddress;
  try {
    // The generated enum only lists known MultiAccount deployments; the API
    // accepts any address, so widen at the wire boundary.
    const response = await checkInWhiteListCheckInWhitelistAddressMultiAccountAddressGet(
      parameters.address,
      multiAccountAddress as MultiAccountEnum,
      { baseURL: solver.url },
    );
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "CHECK_SOLVER_WHITELIST_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "CHECK_SOLVER_WHITELIST_FAILED",
      `Failed to check solver whitelist: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
