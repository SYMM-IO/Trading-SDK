import type { Address } from "viem";
import type { Config, SymmioWalletClient } from "../../core/config";
import type { ResolvedGaslessBatchEntry } from "../batch/resolve-gasless-batch";

/**
 * Resolve one client per requested signer, aligned with the batch's entries.
 * The configured default is resolved only when an entry needs it.
 *
 * @param config - The SDK config with the consumer's wallet resolver.
 * @param parameters - Chain, entries, and optional batch-level signer.
 * @returns Wallet clients in execution order.
 * @internal
 */
export async function resolveBatchSigners(
  config: Config,
  parameters: { chainId: number; entries: readonly ResolvedGaslessBatchEntry[]; from?: Address },
): Promise<SymmioWalletClient[]> {
  const { chainId, entries, from } = parameters;
  const byFrom = new Map<string, Promise<SymmioWalletClient>>();
  const needsDefault = entries.some((entry) => (entry.from ?? from) === undefined);
  const defaultClient = needsDefault ? await config.getWalletClient({ chainId }) : undefined;
  if (defaultClient) byFrom.set(defaultClient.account.address.toLowerCase(), Promise.resolve(defaultClient));

  return Promise.all(
    entries.map((entry) => {
      const requested = entry.from ?? from;
      if (requested === undefined) return defaultClient!;
      const key = requested.toLowerCase();
      const client = byFrom.get(key) ?? config.getWalletClient({ chainId, from: requested });
      byFrom.set(key, client);
      return client;
    }),
  );
}
