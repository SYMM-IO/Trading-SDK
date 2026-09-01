import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/**
 * Parameters for {@link forceCancelQuote}.
 */
export type ForceCancelQuoteParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount (partyA) that owns the quote. Routed through the AccountLayer
     * `_call` proxy so the core sees this subaccount as the caller; the connected
     * wallet must be its on-chain `owner`.
     */
    account: Address;
    /** The `CANCEL_PENDING` quote id to force-cancel. */
    quoteId: bigint;
  }
>;

/** Return type of {@link forceCancelQuote}: the submitted transaction hash. */
export type ForceCancelQuoteReturnType = Hash;

/**
 * Force-cancel a stuck quote (`forceCancelQuote`) — the escalation when partyB
 * stalls on a cancel request.
 *
 * A quote reaches `CANCEL_PENDING` only when it was `LOCKED` and partyA called
 * `requestToCancelQuote` (a `PENDING` quote cancels instantly and never needs
 * this). If partyB does not acknowledge within `coolDownsOfMA()[1]`
 * (`forceCancelCooldown`) after the request, partyA may force it. The core
 * `forceCancelQuote(quoteId)` is routed through `AccountLayer._call(account, …)`;
 * the connected wallet must be the sub-account's `owner`.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - The owning subaccount, the quote id, optional `from` / pre-flight / chain id.
 * @returns The submitted transaction hash.
 * @throws {SymmError} when the chain is unsupported or no wallet client is available.
 *
 * @example
 * ```ts
 * const hash = await forceCancelQuote(config, { account: "0xsub…", quoteId: 42n });
 * ```
 */
export async function forceCancelQuote(
  config: Config,
  parameters: ForceCancelQuoteParameters,
): Promise<ForceCancelQuoteReturnType> {
  const { chainId, account, quoteId } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "forceCancelQuote",
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
