import { isAxiosError } from "axios";
import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { Compute, ReadSolverParameter } from "../../shared/types/properties";
import { assertSolverKind } from "../assert-solver-kind";
import { getCounterpartyUpnlPartyAUpnlAddressGet } from "../types/generated/rasa-solver";

/** Parameters for {@link getPartyAUpnl}. */
export type GetPartyAUpnlParameters = Compute<
  ReadSolverParameter & {
    /** PartyA (subaccount) address to read the unrealized PnL for. */
    address: Address;
  }
>;

/** Return type of {@link getPartyAUpnl} — the uPnL as a decimal string. */
export type GetPartyAUpnlReturnType = string;

/**
 * Fetch a partyA's unrealized PnL from the Rasa-only `/partyA_upnl` endpoint.
 *
 * @param config - The SDK config.
 * @param parameters - PartyA address plus optional chain/solver.
 * @returns The unrealized PnL as a decimal string.
 * @throws {SymmError} `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 * @throws {SymmApiError} when the API request fails.
 */
export async function getPartyAUpnl(
  config: Config,
  parameters: GetPartyAUpnlParameters,
): Promise<GetPartyAUpnlReturnType> {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId });
  assertSolverKind(solver, "rasa", "getPartyAUpnl");
  try {
    const response = await getCounterpartyUpnlPartyAUpnlAddressGet(parameters.address, { baseURL: solver.url });
    return response.data;
  } catch (err) {
    if (err instanceof SymmError) throw err;
    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_PARTY_A_UPNL_FAILED", baseURL: solver.url });
    }
    throw new SymmError(
      "api",
      "FETCH_PARTY_A_UPNL_FAILED",
      `Failed to fetch partyA uPnL: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
