import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { rethrowTpSlError } from "../internal/axios";
import { resolveTpSlConfig } from "../internal/resolve-tpsl-config";
import type { TpSlSigningSpec } from "../types";
import { v5SigningSpecApiV5SigningSpecGet } from "../types/generated/tpsl-handler";

/** Parameters for {@link getTpSlSigningSpec}. */
export type GetTpSlSigningSpecParameters = Compute<ChainIdParameter>;

/** Return type of {@link getTpSlSigningSpec}. */
export type GetTpSlSigningSpecReturnType = TpSlSigningSpec;

/**
 * Fetch the handler's EIP-712 signing spec. The spec is server-published and
 * stable per deployment — cache it indefinitely (`staleTime: Infinity` from
 * the React layer). The openapi spec declares the response as `unknown`, so the
 * generated client returns `unknown` and we cast to {@link TpSlSigningSpec}.
 *
 * @throws {SymmError} when the chain has no `tpsl` config.
 * @throws {SymmApiError} when the HTTP request fails.
 */
export async function getTpSlSigningSpec(
  config: Config,
  parameters: GetTpSlSigningSpecParameters = {},
): Promise<TpSlSigningSpec> {
  const tpsl = resolveTpSlConfig(config, parameters.chainId);
  try {
    const response = await v5SigningSpecApiV5SigningSpecGet({
      baseURL: tpsl.url,
      headers: { "App-Name": tpsl.appName, Accept: "application/json" },
    });
    return response.data as TpSlSigningSpec;
  } catch (err) {
    return rethrowTpSlError(err, { code: "FETCH_TPSL_SIGNING_SPEC_FAILED", baseURL: tpsl.url });
  }
}
