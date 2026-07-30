import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import {
  whitelistCheckSubAddressAddSubAddressInWhitelistAddressMultiAccountAddressGet,
  type MultiAccountEnum,
  type StatusResponse,
} from "../types/generated/rasa-solver";

/** Parameters for {@link addSolverWhitelist}. */
export type AddSolverWhitelistParameters = Compute<
  ReadSolverParameter & {
    /** Address to add to the solver's whitelist. */
    address: Address;
    /** MultiAccount contract address; defaults to the chain's `accountLayerAddress`. */
    multiAccountAddress?: Address;
  }
>;

/** Return type of {@link addSolverWhitelist}. */
export type AddSolverWhitelistReturnType = StatusResponse;

/**
 * Add an address to the solver's whitelist via the Rasa-only
 * `/add-sub-address-in-whitelist` endpoint. Mutates solver-side state (the
 * endpoint is a GET on the wire, but semantically a write — expose it through
 * mutation options, not a query).
 *
 * @param config - The SDK config.
 * @param parameters - Address, optional MultiAccount override, optional chain/solver.
 * @returns `{ successful, message }`.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function addSolverWhitelist(
  config: Config,
  parameters: AddSolverWhitelistParameters,
): Promise<AddSolverWhitelistReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "addSolverWhitelist");
  const multiAccountAddress =
    parameters.multiAccountAddress ?? config.getChainConfig(parameters.chainId).addresses.accountLayerAddress;
  try {
    // The generated enum only lists known MultiAccount deployments; the API
    // accepts any address, so widen at the wire boundary.
    const response = await whitelistCheckSubAddressAddSubAddressInWhitelistAddressMultiAccountAddressGet(
      parameters.address,
      multiAccountAddress as MultiAccountEnum,
      { baseURL: solver.url },
    );
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "ADD_SOLVER_WHITELIST_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "ADD_SOLVER_WHITELIST_FAILED",
      `Failed to add to solver whitelist: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
