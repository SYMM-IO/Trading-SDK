import type { Address, Hash, Hex } from "viem";
import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { SubAccountIsolationType, type SingleUpnlSig } from "../../account-layer/types";
import type { WithdrawReceiverPart } from "../types";
import { deallocateAndInitiateWithdraw } from "./deallocate-and-initiate-withdraw";
import { initiateWithdraw } from "./initiate-withdraw";

/**
 * Parameters for {@link withdraw}.
 */
export type WithdrawParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount to withdraw from. Both underlying actions route the call
     * through the AccountLayer `_call` proxy so the core attributes it to this
     * subaccount; the connected wallet must be its on-chain `owner`.
     */
    account: Address;
    /**
     * The subaccount's isolation strategy, which selects the withdraw path:
     * `CUSTOM` (cross-margin) deallocates then initiates; `MARKET` /
     * `MARKET_DIRECTION` (VA / lowcap) initiate only. Read it from the
     * subaccount detail (`getSubAccount` → `isolationType`).
     */
    isolationType: SubAccountIsolationType;
    /**
     * The receiver parts the withdrawal is split into. A plain same-chain
     * withdrawal is a single part with both provider fields set to the zero
     * address — see `createClassicWithdrawPart`.
     */
    parts: readonly WithdrawReceiverPart[];
    /**
     * Amount to move from the allocated balance back into the available balance,
     * in **18 decimals** (not the collateral token's decimals). Consumed only by
     * the `deallocate` leg, so it is **required when `isolationType` is `CUSTOM`**
     * and ignored otherwise.
     */
    amount?: bigint;
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
     * A fresh Muon uPnL (`uPnl_A`) attestation for `account`, used only by the
     * `CUSTOM` (deallocate) path. Omit it to have the action fetch a fresh one;
     * pass one only to reuse a signature you already fetched. Ignored on the
     * `MARKET` / `MARKET_DIRECTION` path.
     */
    upnlSig?: SingleUpnlSig;
  }
>;

/** Return type of {@link withdraw}: the submitted transaction hash. */
export type WithdrawReturnType = Hash;

/**
 * Withdraw from a subaccount, dispatching on its isolation strategy so callers
 * do not have to branch on where the collateral currently sits.
 *
 * The subaccount's {@link SubAccountIsolationType} determines which balance the
 * funds are in and therefore which underlying action runs:
 *
 * | `isolationType`                     | Balance   | Action                               |
 * | ----------------------------------- | --------- | ------------------------------------ |
 * | `CUSTOM` (cross-margin)             | allocated | {@link deallocateAndInitiateWithdraw} |
 * | `MARKET` / `MARKET_DIRECTION` (VA)  | available | {@link initiateWithdraw}              |
 *
 * `CUSTOM` funds sit in the **allocated** balance, so they must first be
 * deallocated into the available balance; this path batches the `deallocate` and
 * `initiateWithdraw` legs into one atomic transaction and therefore **requires**
 * `amount` (the 18-decimal deallocate amount). The VA paths (`MARKET` /
 * `MARKET_DIRECTION`) already hold their funds in the **available** balance, so
 * they only initiate the withdraw request and ignore `amount`.
 *
 * @remarks
 * Both underlying actions route through the AccountLayer `_call` proxy and dry-run
 * before writing unless `simulateBeforeWrite` is `false`. The `CUSTOM` path also
 * fetches a fresh Muon `upnlSig` for its `deallocate` leg when one is not passed —
 * see {@link deallocateAndInitiateWithdraw}. Reach for the underlying actions
 * directly when you already know the subaccount's isolation and want to skip the
 * dispatch.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount, its `isolationType`, receiver parts, optional
 *   speed-up / provider data, optional Muon `upnlSig`, optional chain id, and
 *   `amount` (18 decimals) — required for `CUSTOM`, ignored otherwise.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} `validation` / `WITHDRAW_AMOUNT_REQUIRED` when
 *   `isolationType` is `CUSTOM` but `amount` is omitted; also the config/wallet
 *   errors the underlying actions throw.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const { isolationType } = await getSubAccount(config, { account: "0xsub…" });
 * const part = createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: "0xabc…", chainId: 999n });
 * const hash = await withdraw(config, {
 *   account: "0xsub…",
 *   isolationType,
 *   parts: [part],
 *   // required only when isolationType === SubAccountIsolationType.CUSTOM:
 *   amount: 1_000000000000000000n,
 * });
 * ```
 */
export async function withdraw(config: Config, parameters: WithdrawParameters): Promise<WithdrawReturnType> {
  if (parameters.isolationType === SubAccountIsolationType.CUSTOM) {
    if (parameters.amount === undefined) {
      throw new SymmError(
        "validation",
        "WITHDRAW_AMOUNT_REQUIRED",
        "A CUSTOM (cross-margin) subaccount must supply `amount` (18-decimals) — the deallocate leg needs it.",
      );
    }
    return deallocateAndInitiateWithdraw(config, {
      account: parameters.account,
      amount: parameters.amount,
      parts: parameters.parts,
      speedUp: parameters.speedUp,
      providerData: parameters.providerData,
      upnlSig: parameters.upnlSig,
      chainId: parameters.chainId,
      from: parameters.from,
      simulateBeforeWrite: parameters.simulateBeforeWrite,
    });
  }

  return initiateWithdraw(config, {
    account: parameters.account,
    parts: parameters.parts,
    speedUp: parameters.speedUp,
    providerData: parameters.providerData,
    chainId: parameters.chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
