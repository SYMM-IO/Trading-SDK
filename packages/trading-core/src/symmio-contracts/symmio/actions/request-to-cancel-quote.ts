import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/**
 * Parameters for {@link requestToCancelQuote}.
 */
export type RequestToCancelQuoteParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount (partyA) that owns the quote. The call is routed through the
     * AccountLayer `_call` proxy so the core sees this subaccount as the caller;
     * the connected wallet must be its on-chain `owner`.
     */
    account: Address;
    /** The pending quote id to cancel — e.g. a resting LIMIT order. */
    quoteId: bigint;
  }
>;

/** Return type of {@link requestToCancelQuote}: the submitted transaction hash. */
export type RequestToCancelQuoteReturnType = Hash;

/**
 * Request cancellation of a pending quote (`requestToCancelQuote`) — the way a
 * partyA cancels a resting **LIMIT order** (or any not-yet-opened quote).
 *
 * The core `requestToCancelQuote(quoteId)` must be attributed to the sub-account,
 * so it is encoded and routed through `AccountLayer._call(account, …)`; the
 * connected wallet must be the sub-account's `owner`. A `PENDING` quote cancels
 * immediately; a `LOCKED` one enters `CANCEL_PENDING` until partyB acknowledges.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The owning subaccount, the quote id, optional `from` / pre-flight / chain id.
 * @returns The submitted transaction hash.
 * @throws {SymmError} when the chain is unsupported or no wallet client is available.
 *
 * @example
 * ```ts
 * const hash = await requestToCancelQuote(config, { account: "0xsub…", quoteId: 42n });
 * ```
 */
export async function requestToCancelQuote(
  config: Config,
  parameters: RequestToCancelQuoteParameters,
): Promise<RequestToCancelQuoteReturnType> {
  const { chainId, account, quoteId } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "requestToCancelQuote",
    args: [quoteId],
  });

  return callAsSubAccount(config, {
    account,
    data,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
