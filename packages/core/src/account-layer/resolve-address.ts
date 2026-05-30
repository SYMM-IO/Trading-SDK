import type { Address, Client } from "viem";
import { getChainConfig } from "../chains";
import { SymmError } from "../errors";

/**
 * Resolve the `AccountLayer` address used for a call: explicit override wins,
 * then the built-in per-chain registry (production environment).
 *
 * @internal — not part of the public surface.
 */
export function resolveAccountLayerAddress(client: Pick<Client, "chain">, override?: Address): Address {
  if (override) return override;

  const chainId = client.chain?.id;

  if (chainId === undefined) {
    throw new SymmError(
      "viem client has no `chain` bound. Pass `accountLayerAddress` explicitly or recreate the client with a `chain` set.",
    );
  }

  const config = getChainConfig(chainId);
  return config.addresses.accountLayerAddress;
}
