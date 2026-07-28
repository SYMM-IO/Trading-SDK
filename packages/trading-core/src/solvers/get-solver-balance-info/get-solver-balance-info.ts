import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import {
  getBalanceInfoGetBalanceInfoAddressMultiAccountAddressGet,
  type BalanceInfoResponseSchema,
  type MultiAccountEnum,
} from "../types/generated/rasa-solver";

/** Parameters for {@link getSolverBalanceInfo}. */
export type GetSolverBalanceInfoParameters = Compute<
  ReadSolverParameter & {
    /** Account (partyA / subaccount) address to read balance info for. */
    address: Address;
    /** MultiAccount contract address; defaults to the chain's `accountLayerAddress`. */
    multiAccountAddress?: Address;
  }
>;

/** Return type of {@link getSolverBalanceInfo}. */
export type GetSolverBalanceInfoReturnType = BalanceInfoResponseSchema;

/**
 * Fetch solver-side balance info (per-counterparty allocated balance / uPnL
 * snapshots) from the Rasa-only `/get_balance_info` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - Account address, optional MultiAccount override, optional chain/solver.
 * @returns Raw balance-info rows from the solver.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function getSolverBalanceInfo(
  config: Config,
  parameters: GetSolverBalanceInfoParameters,
): Promise<GetSolverBalanceInfoReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "getSolverBalanceInfo");
  const multiAccountAddress =
    parameters.multiAccountAddress ?? config.getChainConfig(parameters.chainId).addresses.accountLayerAddress;
  try {
    // The generated enum only lists known MultiAccount deployments; the API
    // accepts any address, so widen at the wire boundary.
    const response = await getBalanceInfoGetBalanceInfoAddressMultiAccountAddressGet(
      parameters.address,
      multiAccountAddress as MultiAccountEnum,
      { baseURL: solver.url },
    );
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_SOLVER_BALANCE_INFO_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_SOLVER_BALANCE_INFO_FAILED",
      `Failed to fetch solver balance info: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
