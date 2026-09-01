import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/**
 * Parameters for {@link forceCancelCloseRequest}.
 */
export type ForceCancelCloseRequestParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount (partyA) that owns the quote. Routed through the AccountLayer
     * `_call` proxy so the core sees this subaccount as the caller; the connected
     * wallet must be its on-chain `owner`.
     */
    account: Address;
    /** The `CANCEL_CLOSE_PENDING` quote id to force-cancel the close on. */
    quoteId: bigint;
  }
>;

/** Return type of {@link forceCancelCloseRequest}: the submitted transaction hash. */
export type ForceCancelCloseRequestReturnType = Hash;

/**
 * Force-cancel a stuck close request (`forceCancelCloseRequest`) — the escalation
 * when partyB stalls on a close-cancel request.
 *
 * A quote reaches `CANCEL_CLOSE_PENDING` only when it was `CLOSE_PENDING` and
 * partyA called `requestToCancelCloseRequest`. If partyB does not acknowledge
 * within `coolDownsOfMA()[2]` (`forceCancelCloseCooldown`) after the request,
 * partyA may force it — the quote returns to `OPENED`. The core
 * `forceCancelCloseRequest(quoteId)` is routed through `AccountLayer._call(account, …)`;
 * the connected wallet must be the sub-account's `owner`.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The owning subaccount, the quote id, optional `from` / pre-flight / chain id.
 * @returns The submitted transaction hash.
 * @throws {SymmError} when the chain is unsupported or no wallet client is available.
 *
 * @example
 * ```ts
 * const hash = await forceCancelCloseRequest(config, { account: "0xsub…", quoteId: 42n });
 * ```
 */
export async function forceCancelCloseRequest(
  config: Config,
  parameters: ForceCancelCloseRequestParameters,
): Promise<ForceCancelCloseRequestReturnType> {
  const { chainId, account, quoteId } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "forceCancelCloseRequest",
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
