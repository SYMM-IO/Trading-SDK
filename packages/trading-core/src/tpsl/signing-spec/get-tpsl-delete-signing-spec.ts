import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { rethrowTpSlError } from "../internal/axios";
import { resolveTpSlConfig } from "../internal/resolve-tpsl-config";
import type { TpSlSigningSpec } from "../types";
import { v5SigningSpecDelApiV5SigningSpecDelGet } from "../types/generated/tpsl-handler";

/** Parameters for {@link getTpSlDeleteSigningSpec}. */
export type GetTpSlDeleteSigningSpecParameters = Compute<ChainIdParameter>;

/** Return type of {@link getTpSlDeleteSigningSpec}. */
export type GetTpSlDeleteSigningSpecReturnType = TpSlSigningSpec;

/**
 * Fetch the handler's EIP-712 signing spec for the DELETE endpoint
 * (`/api/v5/signing-spec-del`). Stable per deployment — cache indefinitely.
 * Distinct from the POST signing spec because the delete typed data uses a
 * different `primaryType` and message struct.
 *
 * @throws {SymmError} when the chain has no `tpsl` config.
 * @throws {SymmApiError} when the HTTP request fails.
 */
export async function getTpSlDeleteSigningSpec(
  config: Config,
  parameters: GetTpSlDeleteSigningSpecParameters = {},
): Promise<TpSlSigningSpec> {
  const tpsl = resolveTpSlConfig(config, parameters.chainId);
  try {
    const response = await v5SigningSpecDelApiV5SigningSpecDelGet({
      baseURL: tpsl.url,
      headers: { "App-Name": tpsl.appName, Accept: "application/json" },
    });
    return response.data as TpSlSigningSpec;
  } catch (err) {
    return rethrowTpSlError(err, { code: "FETCH_TPSL_DELETE_SIGNING_SPEC_FAILED", baseURL: tpsl.url });
  }
}
