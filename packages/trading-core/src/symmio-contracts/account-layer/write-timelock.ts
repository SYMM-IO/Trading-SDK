import { encodeFunctionData, isAddressEqual, type Address, type Hash } from "viem";
import type { Config } from "../../core/config";
import { maybeRelayAsGasless } from "../../gasless/dispatch/maybe-relay-as-gasless";
import { SymmError } from "../../shared/errors/symm-error";
import { shouldSimulateBeforeWrite } from "../../shared/utils/simulate-before-write";
import { assertTimelockSupported } from "../../timelock/support";
import { accountLayerAbi } from "../abi/v0.8.6/account-layer";
import { resolveTimelockRootAccount } from "./resolve-timelock-root-account/resolve-timelock-root-account";
import type { TimelockWriteParameters } from "./timelock-types";

type TimelockWriteFunction =
  | "setupTimelocks"
  | "clearTimelocks"
  | "scheduleTimelockOp"
  | "cancelTimelockOp"
  | "executeTimelockOp";

/** @internal Shared AccountLayer submission pipeline for timelock writes. */
export async function writeTimelock(
  config: Config,
  parameters: TimelockWriteParameters & { account: Address },
  functionName: TimelockWriteFunction,
  args: readonly unknown[],
): Promise<Hash> {
  assertTimelockSupported(config, parameters.chainId);
  const rootAccount = await resolveTimelockRootAccount(config, parameters);
  if (!isAddressEqual(rootAccount, parameters.account))
    throw new SymmError(
      "validation",
      "TIMELOCK_ROOT_ACCOUNT_REQUIRED",
      `Timelock policy, schedules, and approvals belong to root sub-account ${rootAccount}, not virtual account ${parameters.account}.`,
    );
  const { addresses, chainId } = config.getChainConfig(parameters.chainId);
  const callData = encodeFunctionData({ abi: accountLayerAbi, functionName, args } as never);
  const relayed = await maybeRelayAsGasless(config, {
    chainId: parameters.chainId,
    from: parameters.from,
    gasless: parameters.gasless,
    signerAccount: parameters.account,
    calls: [{ target: addresses.accountLayerAddress, callData }],
  });
  if (relayed !== null) return relayed;

  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });
  if (walletClient.chain?.id !== chainId)
    throw new SymmError(
      "validation",
      "TIMELOCK_WALLET_CHAIN_MISMATCH",
      "Switch the execution wallet to the selected chain.",
    );
  if (shouldSimulateBeforeWrite(config, parameters))
    await config.getClient({ chainId: parameters.chainId }).simulateContract({
      address: addresses.accountLayerAddress,
      abi: accountLayerAbi,
      functionName,
      args,
      account: walletClient.account.address,
    } as never);
  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName,
    args,
    account: walletClient.account,
    chain: walletClient.chain,
  } as never);
}
