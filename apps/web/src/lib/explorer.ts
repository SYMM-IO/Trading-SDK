import { hyperEvm } from "viem/chains";

/**
 * App targets HyperEVM (see `config/wagmi.ts`). These helpers resolve the
 * chain's canonical block-explorer URL from viem's chain definition so we
 * never hard-code a base URL. Return `undefined` when the chain ships no
 * explorer, letting callers skip the link.
 */
const EXPLORER_BASE = hyperEvm.blockExplorers?.default?.url;

export function addressExplorerUrl(address: string): string | undefined {
  return EXPLORER_BASE ? `${EXPLORER_BASE}/address/${address}` : undefined;
}

export function txExplorerUrl(hash: string): string | undefined {
  return EXPLORER_BASE ? `${EXPLORER_BASE}/tx/${hash}` : undefined;
}
