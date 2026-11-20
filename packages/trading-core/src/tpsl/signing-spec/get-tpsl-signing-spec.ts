import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { rethrowTpSlError } from "../internal/axios";
import { resolveTpSlConfig } from "../internal/resolve-tpsl-config";
import { readCachedTpSlSigningSpec } from "../signing-spec-cache";
import type { TpSlSigningSpec } from "../types";
import { v5SigningSpecApiV5SigningSpecGet } from "../types/generated/tpsl-handler";

/** Parameters for {@link getTpSlSigningSpec}. */
export type GetTpSlSigningSpecParameters = Compute<ChainIdParameter>;

/** Return type of {@link getTpSlSigningSpec}. */
export type GetTpSlSigningSpecReturnType = TpSlSigningSpec;

/**
 * Read the handler's EIP-712 signing spec. Successful complete schemas are shared
 * for five minutes within this config and deployment, including concurrent reads.
 * Failed or incomplete responses are not retained. The openapi response is `unknown`, so the
 * generated client returns `unknown` and we cast to {@link TpSlSigningSpec}.
 *
 * @param config - SDK config that owns this schema cache.
 * @param parameters - Optional target chain; defaults to the config's chain.
 * @returns The handler's EIP-712 domain, types and primary type.
 * @throws {SymmError} when the chain has no `tpsl` config.
 * @throws {SymmApiError} when the HTTP request fails.
 */
export async function getTpSlSigningSpec(
  config: Config,
  parameters: GetTpSlSigningSpecParameters = {},
): Promise<TpSlSigningSpec> {
  const tpsl = resolveTpSlConfig(config, parameters.chainId);
  try {
    return await readCachedTpSlSigningSpec(
      config,
      { chainId: parameters.chainId, handler: tpsl, method: "POST" },
      async () => {
        const response = await v5SigningSpecApiV5SigningSpecGet({
          baseURL: tpsl.url,
          headers: { "App-Name": tpsl.appName, Accept: "application/json" },
        });
        return response.data as TpSlSigningSpec;
      },
    );
  } catch (err) {
    return rethrowTpSlError(err, { code: "FETCH_TPSL_SIGNING_SPEC_FAILED", baseURL: tpsl.url });
  }
}
