import type { Address } from "viem";
import { hyperEvm } from "viem/chains";
import { SymmError } from "../errors";

/**
 * Built-in per-chain `AccountLayer` (v0.8.5) addresses.
 *
 * Today this contains HyperEVM only. Other chains in the SYMM deployments
 * (Polygon, Arbitrum, Mantle, Base) will be added as the SDK expands.
 * Consumers can always pass `{ accountLayerAddress: '0x...' }` to an SDK call
 * to bypass the registry — useful for staging deployments and new chains that
 * ship before an SDK release.
 *
 * Chain ids are sourced from `viem/chains` so we never spell them as literals
 * (e.g. use `hyperEvm.id`, not `999`). Address source:
 * `explorer/src/config/deployments/index.ts` (deployment id `hyperevm`). The
 * staging address (`hyperevm-stage`) is intentionally not registered; staging
 * callers should pass it explicitly per call.
 */
const ACCOUNT_LAYER_ADDRESSES: Readonly<Record<number, Address>> = {
  [hyperEvm.id]: "0x46493c376758Da47823D7E3Ae5d417eA6546eEB3",
};

/**
 * Resolve the `AccountLayer` contract address for a chain.
 *
 * @throws {SymmError} when the chain is not in the built-in registry.
 *
 * @example
 * ```ts
 * import { hyperEvm } from "viem/chains";
 * const address = getAccountLayerAddress(hyperEvm.id);
 * ```
 */
export function getAccountLayerAddress(chainId: number): Address {
  const address = ACCOUNT_LAYER_ADDRESSES[chainId];

  if (!address) {
    throw new SymmError(
      `No AccountLayer address registered for chain ${chainId}. ` +
        `Pass \`accountLayerAddress\` explicitly, or open an issue to add the chain.`,
    );
  }

  return address;
}

/**
 * List the chain ids the SDK ships a built-in `AccountLayer` address for.
 */
export function listAccountLayerChains(): number[] {
  return Object.keys(ACCOUNT_LAYER_ADDRESSES).map(Number);
}
