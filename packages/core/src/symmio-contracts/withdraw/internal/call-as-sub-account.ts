import type { Address, Hash, Hex } from "viem";
import type { Config } from "../../../core/config";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";

/**
 * Execute pre-encoded SYMMIO-core calldata **as a subaccount**, by routing it
 * through the AccountLayer's `_call(account, callDatas[])` proxy.
 *
 * Internal helper for withdraw writes whose underlying core function takes the
 * caller (the subaccount) as the implicit `msg.sender` — `initiateWithdraw`,
 * `requestCancelWithdraw` — and therefore cannot be sent to the core directly by
 * the owner EOA.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount address, the encoded core calldata, optional chain id.
 * @returns The submitted transaction hash.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 */
export async function callAsSubAccount(
  config: Config,
  parameters: { account: Address; data: Hex; chainId?: number },
): Promise<Hash> {
  const { account, data, chainId } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId });

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "_call",
    args: [account, [data]],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
