import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { SingleUpnlSig } from "../../account-layer/types";
import { callAsSubAccount } from "../internal/call-as-sub-account";

/**
 * Parameters for {@link deallocate}.
 */
export type DeallocateParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount to deallocate from. The call is routed through the
     * AccountLayer `_call` proxy; the connected wallet must be its on-chain `owner`.
     */
    account: Address;
    /**
     * Amount to move from the allocated balance back into the available balance,
     * in **18 decimals** (not the collateral token's decimals).
     */
    amount: bigint;
    /**
     * A fresh Muon uPnL (`uPnl_A`) attestation for `account`. The contract
     * verifies it to prove the subaccount stays solvent after the deallocation.
     * Fetch one right before submitting (it is timestamped and short-lived) — see
     * {@link getDeallocateUpnlSig}.
     */
    upnlSig: SingleUpnlSig;
  }
>;

/** Return type of {@link deallocate}: the submitted transaction hash. */
export type DeallocateReturnType = Hash;

/**
 * Move collateral from a subaccount's **allocated (tradeable) balance** back into
 * its **available balance** on the SYMMIO core.
 *
 * The reverse of {@link allocate}: the subaccount's allocated balance is debited
 * and its available balance credited, in 18-decimal units, after the contract
 * verifies the Muon uPnL signature keeps the subaccount solvent. The freed
 * collateral can then be withdrawn (subject to the separate withdraw cooldown).
 *
 * Encodes the SYMMIO core `deallocate(amount, upnlSig)` call and routes it through
 * `AccountLayer._call(account, …)` so the core attributes it to the subaccount.
 *
 * @remarks
 * Subject to the on-chain **deallocate debounce**: calling too soon after a prior
 * deallocate reverts ("Too many deallocate in a short window"). This is distinct
 * from the withdraw cooldown that later gates moving the freed collateral to the
 * wallet. The `upnlSig` must be freshly fetched — a stale attestation reverts.
 *
 * Dry-runs the call with {@link simulateDeallocate} first unless `simulateBeforeWrite`
 * is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount, amount (18 decimals), Muon `upnlSig`, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const upnlSig = await getDeallocateUpnlSig(config, { virtualAccount: "0xsub…" });
 * const hash = await deallocate(config, { account: "0xsub…", amount: 1_000000000000000000n, upnlSig });
 * ```
 */
export async function deallocate(config: Config, parameters: DeallocateParameters): Promise<DeallocateReturnType> {
  const { chainId, account, amount, upnlSig } = parameters;

  const data = encodeFunctionData({
    abi: symmioAbi,
    functionName: "deallocate",
    args: [amount, upnlSig],
  });

  return callAsSubAccount(config, {
    account,
    data,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
