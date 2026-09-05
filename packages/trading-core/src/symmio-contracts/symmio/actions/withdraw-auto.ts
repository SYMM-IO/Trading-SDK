import type { Address, Hash, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteContractParameter } from "../../../shared/types/properties";
import { getSubAccount } from "../../account-layer/actions/get-sub-account";
import type { SingleUpnlSig, SubAccountIsolationType } from "../../account-layer/types";
import { createClassicWithdrawPart } from "../parts";
import { withdraw } from "./withdraw";

/**
 * Parameters for {@link withdrawAuto}.
 */
export type WithdrawAutoParameters = Compute<
  WriteContractParameter & {
    /**
     * The subaccount to withdraw from. The action routes the call through the
     * AccountLayer `_call` proxy so the core attributes it to this subaccount; the
     * connected wallet must be its on-chain `owner`.
     */
    account: Address;
    /**
     * Amount to withdraw, in the **collateral token's decimals** (e.g. 6 for a
     * USDC-collateralized chain). The action builds the withdraw part from this
     * amount as-is and, on the `CUSTOM` (cross-margin) path, scales it to the
     * 18-decimal amount the `deallocate` leg needs.
     */
    amount: bigint;
    /** Destination EVM address the freed collateral is withdrawn to. */
    receiver: Address;
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
    /**
     * The subaccount's isolation type. Pass it to **skip the `getSubAccount` read**
     * — the React layer already holds it (cached via `useSubAccount`), so passing it
     * avoids a redundant RPC. Omit it and the action fetches the subaccount to
     * resolve it.
     */
    isolationType?: SubAccountIsolationType;
  }
>;

/** Return type of {@link withdrawAuto}: the submitted transaction hash. */
export type WithdrawAutoReturnType = Hash;

/**
 * Withdraw from a subaccount from a **minimal, collateral-decimals input** — the
 * high-level entry point that does all the plumbing so callers pass only
 * `{ account, amount, receiver }` and never touch isolation, parts, or scaling.
 *
 * The action resolves the subaccount's {@link SubAccountIsolationType} — from the
 * passed `isolationType`, or by reading the subaccount when it is omitted — builds
 * the classic same-chain withdraw part from `amount` (in the collateral token's
 * decimals), scales that amount to 18 decimals for the deallocate leg, and hands
 * off to {@link withdraw} — which dispatches on the resolved isolation:
 *
 * | `isolationType`                     | Balance   | What runs                             |
 * | ----------------------------------- | --------- | ------------------------------------- |
 * | `CUSTOM` (cross-margin)             | allocated | deallocate + initiate in one atomic tx |
 * | `MARKET` / `MARKET_DIRECTION` (VA)  | available | initiate the withdraw request only     |
 *
 * @remarks
 * Account-layer balances are `1e18`-scaled regardless of the collateral token's
 * decimals, so the `CUSTOM` deallocate leg needs the 18-decimal amount; this action
 * derives it as `amount * 10 ** (18 - collateralDecimals)` (assumes
 * `collateralDecimals <= 18`). On the `CUSTOM` path it also fetches a fresh Muon
 * `upnlSig` for the deallocate leg unless one is passed. Reach for {@link withdraw}
 * directly when you already hold the subaccount's `isolationType` and want to skip
 * the extra read, or need custom (multi-part / cross-chain) withdraw parts.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount, `amount` (collateral decimals), `receiver`,
 *   optional speed-up / provider data, optional Muon `upnlSig`, optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * // amount in the collateral token's decimals (6-dec USDC → 1 USDC):
 * const hash = await withdrawAuto(config, {
 *   account: "0xsub…",
 *   amount: 1_000000n,
 *   receiver: "0xabc…",
 * });
 * ```
 */
export async function withdrawAuto(
  config: Config,
  parameters: WithdrawAutoParameters,
): Promise<WithdrawAutoReturnType> {
  const chainId = parameters.chainId ?? config.defaultChainId;

  // Use the caller-supplied isolation type when present (the React layer reads it
  // from cache); otherwise fetch the subaccount to resolve it.
  const isolationType =
    parameters.isolationType ?? (await getSubAccount(config, { account: parameters.account, chainId })).isolationType;
  const { addresses } = config.getChainConfig(chainId);

  const part = createClassicWithdrawPart({
    id: 0n,
    amount: parameters.amount,
    receiver: parameters.receiver,
    chainId: BigInt(chainId),
  });

  // Account-layer balances are 1e18-scaled regardless of collateral decimals; the
  // deallocate leg needs the 18-dec amount. (Assumes collateralDecimals <= 18.)
  const amount18 = parameters.amount * 10n ** BigInt(18 - addresses.collateralDecimals);

  return withdraw(config, {
    account: parameters.account,
    isolationType,
    parts: [part],
    amount: amount18,
    speedUp: parameters.speedUp,
    providerData: parameters.providerData,
    upnlSig: parameters.upnlSig,
    chainId,
    from: parameters.from,
    simulateBeforeWrite: parameters.simulateBeforeWrite,
  });
}
