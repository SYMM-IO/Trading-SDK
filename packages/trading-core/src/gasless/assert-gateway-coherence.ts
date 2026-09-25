import { isAddressEqual } from "viem";
import type { SymmioGaslessConfig } from "../core/chains/types";
import type { Config } from "../core/config";
import { SymmError } from "../shared/errors/symm-error";
import { gaslessLayerAbi } from "../symmio-contracts/abi/v0.8.6/gasless-layer";

/** One coherence probe per (config, chainId) — the gateway address is a config constant. */
const coherenceChecks = new WeakMap<Config, Map<number, Promise<void>>>();

/**
 * Check, once per config and chain, that the configured GaslessLayer verifies
 * operations against the same InstantLayer the chain config signs for.
 *
 * InstantLayer signatures are bound to the chain's `instantLayerAddress`
 * (the EIP-712 `verifyingContract`), while the relay is verified by whichever
 * InstantLayer the GaslessLayer points at. When the two differ, every relayed
 * signature is rejected — after the user has already been prompted for it.
 *
 * @param config - The SDK config.
 * @param chainId - The chain the relay targets.
 * @param gasless - The chain's resolved gasless block.
 * @throws {SymmError} `GASLESS_CONFIG_INCOHERENT` when the two InstantLayer addresses differ.
 *
 * @internal
 */
export function assertGaslessGatewayCoherence(
  config: Config,
  chainId: number,
  gasless: SymmioGaslessConfig,
): Promise<void> {
  let byChain = coherenceChecks.get(config);
  if (!byChain) {
    byChain = new Map();
    coherenceChecks.set(config, byChain);
  }
  const cached = byChain.get(chainId);
  if (cached) return cached;

  const probe = (async () => {
    const { addresses } = config.getChainConfig(chainId);
    const client = config.getClient({ chainId });
    const gatewayInstantLayer = await client.readContract({
      address: gasless.gaslessLayerAddress,
      abi: gaslessLayerAbi,
      functionName: "instantLayer",
    });
    if (!isAddressEqual(gatewayInstantLayer, addresses.instantLayerAddress)) {
      throw new SymmError(
        "config",
        "GASLESS_CONFIG_INCOHERENT",
        `Gasless: the configured GaslessLayer (${gasless.gaslessLayerAddress}) verifies operations against InstantLayer ${gatewayInstantLayer}, but chain ${chainId} is configured with instantLayerAddress ${addresses.instantLayerAddress}. Relayed signatures would be rejected — align the two addresses (createConfig override) before using gasless execution.`,
      );
    }
  })();
  /**
   * Cache the real probe, not a swallowed copy. A pre-swallowed promise would
   * resolve for every caller that arrived while the first probe was still in
   * flight, so a concurrent write would sail past the guard on a misconfigured
   * chain and sign against an InstantLayer the gateway does not verify.
   *
   * The entry is dropped on rejection so a transient RPC failure cannot poison
   * the config — the next write probes again.
   */
  byChain.set(chainId, probe);
  probe.catch(() => {
    if (byChain.get(chainId) === probe) byChain.delete(chainId);
  });
  return probe;
}
