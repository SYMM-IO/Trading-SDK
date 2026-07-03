import type { Address, Hash, Hex } from "viem";
import type { Config } from "../../../core/config";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import { simulateCallAsSubAccount } from "./simulate-call-as-sub-account";

/**
 * Execute pre-encoded SYMMIO-core calldata **as a subaccount**, by routing it
 * through the AccountLayer's `_call(account, callDatas[])` proxy.
 *
 * Internal helper for withdraw writes whose underlying core function takes the
 * caller (the subaccount) as the implicit `msg.sender` — `initiateWithdraw`,
 * `requestCancelWithdraw` — and therefore cannot be sent to the core directly by
 * the owner EOA.
 *
 * @remarks
 * When the resolved `simulateBeforeWrite` is `true`, the routed `_call` is
 * dry-run via {@link simulateCallAsSubAccount} first; if it would revert the
 * decoded error is thrown and nothing is signed or broadcast.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount address, the encoded core calldata, optional chain id, optional pre-flight opt-out.
 * @returns The submitted transaction hash.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 */
export async function callAsSubAccount(
  config: Config,
  parameters: { account: Address; data: Hex; chainId?: number; from?: Address; simulateBeforeWrite?: boolean },
): Promise<Hash> {
  const { account, data, chainId, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateCallAsSubAccount(config, { account, data, chainId, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "_call",
    args: [account, [data]],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
