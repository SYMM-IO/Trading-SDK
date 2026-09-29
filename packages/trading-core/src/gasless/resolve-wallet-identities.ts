import { isAddressEqual, zeroAddress, type Address } from "viem";
import type { Config } from "../core/config";
import { getSubAccount } from "../symmio-contracts/account-layer/actions/get-sub-account";
import { getVirtualAccount } from "../symmio-contracts/account-layer/actions/get-virtual-account";

/** The identities the GaslessLayer derives from a wallet operation's signer account. @internal */
export interface GaslessWalletIdentities {
  /** The account delegations are checked on: a live virtual account's parent, otherwise the account itself. */
  canonicalAccount: Address;
  /** The owner the wallet belongs to — `ownerOf(canonicalAccount)`, or the account itself when it has none. */
  ownerWallet: Address;
}

/**
 * The identities the GaslessLayer derives from a wallet operation, mirroring
 * `GaslessWalletExecutionLib._walletOwnerForOperation`.
 *
 * A **live** virtual account rolls up to its parent (a deleted one stays
 * itself, so a historical VA cannot widen authority); the wallet then belongs
 * to `ownerOf(canonicalAccount)`, falling back to the account itself when the
 * AccountLayer knows no owner — which is exactly what makes a bare EOA resolve
 * to its own wallet.
 *
 * @param config - The SDK config.
 * @param parameters - The chain and the operation's `signerAccount.addr`.
 * @returns The canonical account and the wallet owner.
 *
 * @internal
 */
export async function resolveGaslessWalletIdentities(
  config: Config,
  parameters: { chainId?: number; account: Address },
): Promise<GaslessWalletIdentities> {
  const { chainId, account } = parameters;

  const virtualAccount = await getVirtualAccount(config, { chainId, account });
  const canonicalAccount = virtualAccount.isExists ? virtualAccount.parentAccount : account;

  const detail = await getSubAccount(config, { chainId, account: canonicalAccount });
  const ownerWallet = detail.isExists && !isAddressEqual(detail.owner, zeroAddress) ? detail.owner : canonicalAccount;

  return { canonicalAccount, ownerWallet };
}
