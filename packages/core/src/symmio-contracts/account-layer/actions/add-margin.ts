import type { Address, Hash } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.5/account-layer";
import { simulateAddMargin } from "./simulate-add-margin";

/**
 * Parameters for {@link addMargin}.
 */
export type AddMarginParameters = Compute<
  WriteContractParameter & {
    /**
     * The virtual account (VA) to add margin to. The connected wallet must be
     * the VA's on-chain owner; the contract reverts (`onlyAccountOwner`) otherwise.
     */
    virtualAccount: Address;
    /**
     * Amount to add, in **18 decimals** (the internal allocated-balance unit,
     * not the collateral token's decimals). Moved from the parent subaccount's
     * already-deposited balance into the VA; reverts with `ZeroAmount` when `0`.
     */
    amount: bigint;
  }
>;

/** Return type of {@link addMargin}: the submitted transaction hash. */
export type AddMarginReturnType = Hash;

/**
 * Add margin to a virtual account (VA) by moving collateral from the parent
 * subaccount's available balance into the VA, on the AccountLayer.
 *
 * Calls `AccountLayer.addMargin(virtualAccount, amount)`, which internally
 * transfers `amount` from the parent subaccount into the VA. This increases the
 * VA's margin (and lowers its liquidation risk). No signature is required.
 *
 * Dry-runs the call with {@link simulateAddMargin} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Virtual account address, amount (18 decimals), optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await addMargin(config, { virtualAccount: "0xva…", amount: 50_000000000000000000n });
 * ```
 */
export async function addMargin(config: Config, parameters: AddMarginParameters): Promise<AddMarginReturnType> {
  const { chainId, virtualAccount, amount, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);
  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateAddMargin(config, { chainId, virtualAccount, amount, from: walletClient.account.address });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "addMargin",
    args: [virtualAccount, amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
