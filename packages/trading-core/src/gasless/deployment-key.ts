import { hash } from "ohash";
import type { Config } from "../core/config";
import type { ChainIdParameter, Compute } from "../shared/types/properties";
import { buildGaslessHttpContext } from "./http";
import { resolveGaslessService } from "./resolve-gasless";
import type { GaslessService } from "./types";

/**
 * Parameters for {@link getGaslessDeploymentKey}.
 */
export type GetGaslessDeploymentKeyParameters = Compute<
  ChainIdParameter & {
    /** Which sub-service the key protects actions on. Defaults to `"operations"`. */
    service?: GaslessService;
  }
>;

/** Return type of {@link getGaslessDeploymentKey}. */
export type GetGaslessDeploymentKeyReturnType = string;

/**
 * A non-secret fingerprint of the gasless deployment a call goes to: chain,
 * contracts version, service URL, protocol instance, and the gasless, SYMMIO,
 * AccountLayer and InstantLayer addresses.
 *
 * An idempotency key protects an action only inside one deployment. Store this
 * value with a pending action and compare it before any retry: a different
 * value means the retry would go somewhere the key does not protect it, so
 * reconcile the action instead of signing it again. Credentials, headers and
 * execution settings never take part.
 *
 * @param config - The SDK config.
 * @param parameters - Optional chain id, and the service (`"operations"` by default, or `"deposits"`).
 * @returns A stable string for that deployment and service.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION` for a chain without gasless support.
 *
 * @example
 * ```ts
 * import { getGaslessDeploymentKey } from "@symmio/trading-core";
 *
 * if (getGaslessDeploymentKey(config, { chainId }) !== action.deploymentKey) {
 *   return reconcile(action);
 * }
 * ```
 */
export function getGaslessDeploymentKey(
  config: Config,
  parameters: GetGaslessDeploymentKeyParameters = {},
): GetGaslessDeploymentKeyReturnType {
  const { chainId, service = "operations" } = parameters;
  const gasless = resolveGaslessService(config, { chainId });
  const chain = config.getChainConfig(chainId);
  const context = buildGaslessHttpContext(chain.chainId, gasless, service);
  return hash([
    1,
    chain.chainId,
    chain.contractsVersion,
    context.baseURL,
    context.protocolInstance,
    gasless.gaslessLayerAddress.toLowerCase(),
    chain.addresses.symmioAddress.toLowerCase(),
    chain.addresses.accountLayerAddress.toLowerCase(),
    chain.addresses.instantLayerAddress.toLowerCase(),
  ]);
}
