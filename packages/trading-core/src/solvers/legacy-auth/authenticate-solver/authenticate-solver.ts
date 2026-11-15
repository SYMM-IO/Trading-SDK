import axios, { isAxiosError } from "axios";
import type { Config } from "../../../core/config";
import { SymmApiError, SymmError } from "../../../shared/errors/symm-error";
import { assertSolverKind } from "../../assert-solver-kind";
import type { AuthenticateSolverParameters, SolverAuthentication } from "../types";

/**
 * Exchange a signed legacy SIWE challenge for a bearer token.
 * @param config - The same deployment used to prepare the challenge.
 * @param parameters - Signed challenge and optional signature type.
 * @returns Token only; the consumer retains expiry and storage policies.
 */
export async function authenticateSolver(
  config: Config,
  parameters: AuthenticateSolverParameters,
): Promise<SolverAuthentication> {
  const solver = config.getSolver(parameters);
  assertSolverKind(solver, "enigma", "authenticateSolver");
  const { challenge } = parameters;
  let data: { access_token?: unknown; error_message?: unknown };
  try {
    const response = await axios.post<typeof data>(
      "/login",
      {
        account_address: challenge.owner,
        expiration_time: challenge.expirationTime,
        issued_at: challenge.issuedAt,
        signature: parameters.signature,
        nonce: challenge.nonce,
        ...(parameters.signType ? { sign_type: parameters.signType } : {}),
      },
      { baseURL: solver.url, signal: parameters.signal, headers: { "Content-Type": "application/json" } },
    );
    data = response.data;
  } catch (error) {
    if (isAxiosError(error)) throw SymmApiError.fromAxios(error, { code: "SOLVER_LOGIN_FAILED", baseURL: solver.url });
    throw error;
  }
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new SymmError(
      "api",
      "SOLVER_LOGIN_FAILED",
      typeof data.error_message === "string" ? data.error_message : "Login failed: no access token returned",
    );
  }
  return { accessToken: data.access_token };
}
