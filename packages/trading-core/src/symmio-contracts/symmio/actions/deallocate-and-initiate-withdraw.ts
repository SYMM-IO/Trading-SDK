import { encodeFunctionData, type Address, type Hash, type Hex } from "viem";
import type { Config } from "../../../core/config";
import { getDeallocateUpnlSig } from "../../../muon/deallocate-upnl-sig/get-deallocate-upnl-sig";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { SingleUpnlSig } from "../../account-layer/types";
import { callAsSubAccount } from "../internal/call-as-sub-account";
import type { WithdrawReceiverPart } from "../types";

/**
 * Parameters for {@link deallocateAndInitiateWithdraw}.
 */
export type DeallocateAndInitiateWithdrawParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount to deallocate from and initiate the withdrawal for. Both
     * inner calls are routed through the AccountLayer `_call` proxy so the core
     * attributes them to this subaccount; the connected wallet must be its
     * on-chain `owner`.
     */
    account: Address;
    /**
     * Amount to move from the allocated balance back into the available balance,
     * in **18 decimals** (not the collateral token's decimals). This is the
     * `deallocate` leg; the freed collateral is what the withdrawal then requests.
     */
    amount: bigint;
    /**
     * The receiver parts the withdrawal is split into. A plain same-chain
     * withdrawal is a single part with both provider fields set to the zero
     * address — see `createClassicWithdrawPart`.
     */
    parts: readonly WithdrawReceiverPart[];
    /**
     * Opt into the cooldown speed-up flow. Only effective for speed-up-eligible
     * users; ignored otherwise.
     * @default false
     */
    speedUp?: boolean;
    /**
     * Opaque provider data forwarded to express/virtual providers (e.g. a signed
     * option). Pass `0x` for a classic withdrawal.
     * @default "0x"
     */
    providerData?: Hex;
    /**
     * A fresh Muon uPnL (`uPnl_A`) attestation for `account`, required by the
     * `deallocate` leg to prove the subaccount stays solvent. It is timestamped
     * and short-lived, so **omit it** to have the action fetch a fresh one (via
     * {@link getDeallocateUpnlSig}) immediately before submitting; pass one only
     * to reuse a signature you already fetched.
     */
    upnlSig?: SingleUpnlSig;
  }
>;

/** Return type of {@link deallocateAndInitiateWithdraw}: the submitted transaction hash. */
export type DeallocateAndInitiateWithdrawReturnType = Hash;

/**
 * Batch a subaccount's **deallocate** and **initiate-withdraw** into a single
 * atomic transaction — the cross-margin / Base withdraw path.
 *
 * Encodes the SYMMIO core `deallocate(amount, upnlSig)` and
 * `initiateWithdraw(parts, speedUp, data)` calls and routes **both** through one
 * `AccountLayer._call(account, [deallocateData, withdrawData])`. `_call` runs the
 * calldatas in order in a single transaction and reverts the whole transaction if
 * any inner call reverts, so the two legs are all-or-nothing: the caller never
 * ends up with a deallocation that failed to produce its withdraw request.
 *
 * **Order matters.** `deallocate` (allocated → available) is encoded first so the
 * freed collateral exists in the available balance before `initiateWithdraw`
 * requests it.
 *
 * @remarks
 * The `deallocate` leg is subject to the on-chain **deallocate debounce** and
 * requires a fresh Muon `upnlSig`; a stale attestation or too-soon a call reverts
 * the whole batch. Dry-runs the batched `_call` with the pre-flight simulation
 * first unless `simulateBeforeWrite` is `false` (per-call, falling back to the
 * config default). For separate control over the two legs, call {@link deallocate}
 * and {@link initiateWithdraw} individually.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount, amount (18 decimals), receiver parts, optional
 *   speed-up / provider data, optional Muon `upnlSig` (fetched automatically via
 *   {@link getDeallocateUpnlSig} when omitted), optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const part = createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: "0xabc…", chainId: 999n });
 * // upnlSig fetched automatically:
 * const hash = await deallocateAndInitiateWithdraw(config, {
 *   account: "0xsub…",
 *   amount: 1_000000000000000000n,
 *   parts: [part],
 * });
 * ```
 */
export async function deallocateAndInitiateWithdraw(
  config: Config,
  parameters: DeallocateAndInitiateWithdrawParameters,
): Promise<DeallocateAndInitiateWithdrawReturnType> {
  const { chainId, account, amount, parts, speedUp = false, providerData = "0x", from } = parameters;

  const upnlSig = parameters.upnlSig ?? (await getDeallocateUpnlSig(config, { virtualAccount: account, chainId }));

  const deallocateData = encodeFunctionData({
    abi: symmioAbi,
    functionName: "deallocate",
    args: [amount, upnlSig],
  });

  const withdrawData = encodeFunctionData({
    abi: symmioAbi,
    functionName: "initiateWithdraw",
    args: [parts, speedUp, providerData],
  });

  // Order matters: deallocate (allocated → available) MUST precede initiateWithdraw.
  return callAsSubAccount(config, {
    account,
    data: [deallocateData, withdrawData],
    chainId,
    from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
