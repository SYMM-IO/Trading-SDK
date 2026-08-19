import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/**
 * Parameters for {@link requestToCancelCloseRequest}.
 */
export type RequestToCancelCloseRequestParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount (partyA) that owns the quote. The call is routed through the
     * AccountLayer `_call` proxy so the core sees this subaccount as the caller;
     * the connected wallet must be its on-chain `owner`.
     */
    account: Address;
    /** The `CLOSE_PENDING` quote id whose close request to cancel. */
    quoteId: bigint;
  }
>;

/** Return type of {@link requestToCancelCloseRequest}: the submitted transaction hash. */
export type RequestToCancelCloseRequestReturnType = Hash;

/**
 * Request cancellation of a pending **close** (`requestToCancelCloseRequest`) —
 * the way a partyA backs out of a resting close (e.g. a limit close) while the
 * quote is `CLOSE_PENDING`.
 *
 * The core `requestToCancelCloseRequest(quoteId)` must be attributed to the
 * sub-account, so it is encoded and routed through `AccountLayer._call(account, …)`;
 * the connected wallet must be the sub-account's `owner`. If partyB accepts, the
 * quote returns to `OPENED`; if partyB stalls, it enters `CANCEL_CLOSE_PENDING`
 * until the force-cancel-close cooldown elapses (see `forceCancelCloseRequest`).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The owning subaccount, the quote id, optional `from` / pre-flight / chain id.
 * @returns The submitted transaction hash.
 * @throws {SymmError} when the chain is unsupported or no wallet client is available.
 *
 * @example
 * ```ts
 * const hash = await requestToCancelCloseRequest(config, { account: "0xsub…", quoteId: 42n });
 * ```
 */
export async function requestToCancelCloseRequest(
  config: Config,
  parameters: RequestToCancelCloseRequestParameters,
): Promise<RequestToCancelCloseRequestReturnType> {
  const { chainId, account, quoteId } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "requestToCancelCloseRequest",
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
