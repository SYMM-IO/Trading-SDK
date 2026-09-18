import { encodeFunctionData, type Hash } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { getAccountBalanceOf, getSubAccount, SubAccountIsolationType } from "../../symmio-contracts/account-layer";
import {
  createClassicWithdrawPart,
  getLastWithdrawRequestId,
  getWithdrawableTime,
  withdrawAuto,
} from "../../symmio-contracts/symmio";
import { callAsSubAccount } from "../../symmio-contracts/symmio/internal/call-as-sub-account";
import { getWithdrawRoute } from "../get-withdraw-route";
import { submitExpressWithdrawOption } from "../submit-express-withdraw-option";
import type { WithdrawWithExpressParameters, WithdrawWithExpressReturnType } from "../types";

/**
 * Prepare or accept a route and execute the corresponding withdrawal flow.
 *
 * @param config - SDK configuration with read and wallet clients.
 * @param parameters - Withdrawal intent, optional policy, and optional prepared route.
 * @returns Submitted hash together with the exact route used.
 */
export async function withdrawWithExpress(
  config: Config,
  parameters: WithdrawWithExpressParameters,
): Promise<WithdrawWithExpressReturnType> {
  const chainId = parameters.chainId ?? config.defaultChainId;
  const isolationType =
    parameters.isolationType ?? (await getSubAccount(config, { account: parameters.account, chainId })).isolationType;
  const route =
    parameters.preparedRoute ??
    (await getWithdrawRoute(config, {
      user: parameters.account,
      amount: parameters.amount,
      receiver: parameters.receiver,
      chainId,
      isolationType,
      policy: parameters.policy,
    }));

  if (route.kind === "express") {
    if (isolationType === SubAccountIsolationType.CUSTOM) {
      throw new SymmError(
        "validation",
        "EXPRESS_WITHDRAW_UNSUPPORTED_ACCOUNT",
        "Express Withdraw cannot use a CUSTOM account whose collateral must first be deallocated.",
      );
    }
    const hash = await submitExpressWithdrawOption(config, {
      account: parameters.account,
      amount: parameters.amount,
      receiver: parameters.receiver,
      option: route.option,
      chainId,
      from: parameters.from,
      simulateBeforeWrite: parameters.simulateBeforeWrite,
      gasless: parameters.gasless,
    });
    return { hash, route };
  }

  if (route.finalize === "immediate") {
    if (isolationType === SubAccountIsolationType.CUSTOM) {
      throw new SymmError(
        "validation",
        "WITHDRAW_IMMEDIATE_UNSUPPORTED_ACCOUNT",
        "A CUSTOM account deallocation resets its cooldown and cannot initiate and finalize immediately.",
      );
    }
    const [withdrawableTime, availableBalance] = await Promise.all([
      getWithdrawableTime(config, { user: parameters.account, chainId }),
      getAccountBalanceOf(config, { account: parameters.account, chainId }),
    ]);
    if (availableBalance < parameters.amount || withdrawableTime > BigInt(Math.floor(Date.now() / 1000))) {
      throw new SymmError(
        "validation",
        "WITHDRAW_ROUTE_STALE",
        "The prepared immediate route no longer has sufficient available balance or is not finalizable; prepare a fresh withdrawal route.",
      );
    }
    const hash = await initiateAndFinalizeClassic(config, { ...parameters, chainId });
    return { hash, route };
  }

  const hash = await withdrawAuto(config, {
    account: parameters.account,
    amount: parameters.amount,
    receiver: parameters.receiver,
    isolationType,
    upnlSig: parameters.upnlSig,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
    gasless: parameters.gasless,
  });
  return { hash, route };
}

async function initiateAndFinalizeClassic(
  config: Config,
  parameters: WithdrawWithExpressParameters & { chainId: number },
): Promise<Hash> {
  const nextRequestId =
    (await getLastWithdrawRequestId(config, { user: parameters.account, chainId: parameters.chainId })) + 1n;
  const part = createClassicWithdrawPart({
    id: 0n,
    amount: parameters.amount,
    receiver: parameters.receiver,
    chainId: BigInt(parameters.chainId),
  });
  const initiateData = encodeFunctionData({
    abi: symmioAbi,
    functionName: "initiateWithdraw",
    args: [[part], false, "0x"],
  });
  const finalizeData = encodeFunctionData({
    abi: symmioAbi,
    functionName: "finalizeWithdrawRequest",
    args: [parameters.account, nextRequestId],
  });

  return callAsSubAccount(config, {
    account: parameters.account,
    data: [initiateData, finalizeData],
    chainId: parameters.chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
    gasless: parameters.gasless,
  });
}
