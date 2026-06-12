import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { ChainIdParameter, Compute, SimulateBeforeWriteParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import type { SingleUpnlSig } from "../types";
import { simulateRemoveMargin } from "./simulate-remove-margin";

/**
 * Parameters for {@link removeMargin}.
 */
export type RemoveMarginParameters = Compute<
  ChainIdParameter &
    SimulateBeforeWriteParameter & {
      /**
       * The virtual account (VA) to remove margin from. The connected wallet must
       * be the VA's on-chain owner; the contract reverts (`onlyAccountOwner`) otherwise.
       */
      virtualAccount: Address;
      /**
       * Amount to remove, in **18 decimals** (the internal allocated-balance unit,
       * not the collateral token's decimals). Moved from the VA back into the
       * parent subaccount's available balance; reverts with `ZeroAmount` when `0`.
       */
      amount: bigint;
      /**
       * A fresh Muon uPnL attestation for `virtualAccount`. The contract verifies
       * it to prove the VA stays solvent after the deallocation. Fetch one right
       * before submitting (it is timestamped and short-lived) — see
       * {@link getDeallocateUpnlSig}.
       */
      upnlSig: SingleUpnlSig;
    }
>;

/** Return type of {@link removeMargin}: the submitted transaction hash. */
export type RemoveMarginReturnType = Hash;

/**
 * Remove margin from a virtual account (VA) — a deallocate — moving collateral
 * from the VA back into the parent subaccount's available balance, on the
 * AccountLayer.
 *
 * Calls `AccountLayer.removeMargin(virtualAccount, amount, upnlSig)`, which
 * deallocates `amount` from the VA after the contract verifies the Muon uPnL
 * signature keeps the VA solvent.
 *
 * @remarks
 * Subject to the on-chain **deallocate debounce**: calling too soon after a prior
 * deallocate reverts ("Too many deallocate in a short window"). This is distinct
 * from the withdraw cooldown that later gates moving the freed collateral to the
 * wallet. The `upnlSig` must be freshly fetched — a stale attestation reverts.
 *
 * Dry-runs the call with {@link simulateRemoveMargin} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Virtual account, amount (18 decimals), Muon `upnlSig`, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const upnlSig = await getDeallocateUpnlSig(config, { virtualAccount: "0xva…" });
 * const hash = await removeMargin(config, { virtualAccount: "0xva…", amount: 50_000000000000000000n, upnlSig });
 * ```
 */
export async function removeMargin(
  config: Config,
  parameters: RemoveMarginParameters,
): Promise<RemoveMarginReturnType> {
  const { chainId, virtualAccount, amount, upnlSig } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateRemoveMargin(config, {
      chainId,
      virtualAccount,
      amount,
      upnlSig,
      from: walletClient.account.address,
    });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "removeMargin",
    args: [virtualAccount, amount, upnlSig],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
