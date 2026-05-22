import type { Account, Chain, Hash, Transport, WalletClient } from "viem";
import { editAccountName, type EditAccountNameParams } from "./methods/edit-account-name";

/**
 * Write methods added to a viem `WalletClient` by {@link accountLayerWriteActions}.
 */
export interface AccountLayerWriteActions {
  editAccountName(params: EditAccountNameParams): Promise<Hash>;
}

/**
 * Attach `AccountLayer` write methods to a viem `WalletClient` via `.extend()`.
 *
 * @example
 * const client = createWalletClient({ chain: hyperevm, account, transport: custom(window.ethereum) }).extend(accountLayerWriteActions);
 * const hash = await client.editAccountName({ account: "0xsub...", name: "Main" });
 */
export function accountLayerWriteActions<TTransport extends Transport, TChain extends Chain>(
  client: WalletClient<TTransport, TChain, Account>,
): AccountLayerWriteActions {
  return {
    editAccountName(params) {
      return editAccountName(client, params);
    },
  };
}
