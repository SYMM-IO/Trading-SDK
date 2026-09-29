import { encodeFunctionData, type Address, type Hash } from "viem";
import type { Config } from "../../../core/config";
import { maybeRelayAsGasless } from "../../../gasless/dispatch/maybe-relay-as-gasless";
import type { Compute, GaslessWriteParameter, WriteContractParameter } from "../../../shared/types/properties";
import { shouldSimulateBeforeWrite } from "../../../shared/utils/simulate-before-write";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import { simulateDepositAndAllocateForAccount } from "./simulate-deposit-and-allocate-for-account";

/**
 * Parameters for {@link depositAndAllocateForAccount}.
 */
export type DepositAndAllocateForAccountParameters = Compute<
  WriteContractParameter &
    GaslessWriteParameter & {
      /**
       * The subaccount (or virtual account) to credit and allocate for. The wallet's
       * signing account must be the subaccount's on-chain `owner`; the contract
       * reverts otherwise.
       */
      account: Address;
      /**
       * Amount of collateral to deposit and allocate, in the collateral token's
       * smallest unit (e.g. `1_000000n` for 1 USDC at 6 decimals). The user must have
       * approved at least this much collateral to the SYMMIO core first — see
       * {@link approveCollateral}.
       */
      amount: bigint;
    }
>;

/** Return type of {@link depositAndAllocateForAccount}: the submitted transaction hash. */
export type DepositAndAllocateForAccountReturnType = Hash;

/**
 * Deposit collateral into a subaccount **and allocate it into trading margin** in
 * a single transaction.
 *
 * Calls `AccountLayer.depositAndAllocateForAccount`. Equivalent to
 * {@link depositForAccount} followed by an allocate, but atomic. The funds land
 * in the classic-pool allocated balance — instant trading spends the available
 * balance instead, so for the instant flow fund with {@link depositForAccount}
 * alone (funds allocated here are not what an instant open consumes).
 *
 * Dry-runs the call with {@link simulateDepositAndAllocateForAccount} first unless
 * `simulateBeforeWrite` is `false` (per-call, falling back to the config default).
 *
 * Relayable: pass `gasless` (or run the chain in `gasless.execution.mode`) to
 * sign the same calldata as an InstantLayer operation instead of sending a
 * transaction. That removes the gas, **not** the approval below — the collateral
 * is still pulled from the owner's wallet. A wallet holding no native token at
 * all should deposit through {@link settleGaslessDepositNewAccount} instead.
 *
 * @remarks
 * Requires a prior ERC20 approval of the collateral token to the **SYMMIO core**
 * (`symmioAddress`), which is the contract that pulls the funds. See
 * {@link approveCollateral} / {@link getCollateralAllowance}.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @param parameters - Subaccount address, amount (collateral units), optional chain id.
 * @returns The submitted transaction hash. The caller waits on the receipt.
 * @throws {SymmError} when the chain is unsupported or no wallet is available.
 * @throws Viem's write errors (`ContractFunctionExecutionError`, ...).
 *
 * @example
 * ```ts
 * const hash = await depositAndAllocateForAccount(config, { account: "0xsub…", amount: 1_000000n });
 * ```
 */
export async function depositAndAllocateForAccount(
  config: Config,
  parameters: DepositAndAllocateForAccountParameters,
): Promise<DepositAndAllocateForAccountReturnType> {
  const { chainId, account, amount, from } = parameters;

  const { addresses } = config.getChainConfig(chainId);

  /**
   * Transparent gasless seam: the same AccountLayer calldata is signed as an
   * InstantLayer operation and relayed. `account` may be a sub-account or a
   * virtual account, so the billing/authority account is resolved from it — a VA
   * bills its parent. Relaying removes the gas, **not** the ERC20 approval: the
   * collateral is still pulled from the owner's wallet, so the allowance to the
   * SYMMIO core must already exist. For a wallet with no native gas at all, use
   * the deposit-settlement flow instead. `null` means: proceed on the wallet
   * path below, unchanged.
   */
  const relayed = await maybeRelayAsGasless(config, {
    chainId,
    from,
    gasless: parameters.gasless,
    accountMaybeVirtual: account,
    calls: [
      {
        target: addresses.accountLayerAddress,
        callData: encodeFunctionData({
          abi: accountLayerAbi,
          functionName: "depositAndAllocateForAccount",
          args: [account, amount],
        }),
      },
    ],
  });
  if (relayed !== null) return relayed;

  const walletClient = await config.getWalletClient({ chainId, from });

  if (shouldSimulateBeforeWrite(config, parameters)) {
    await simulateDepositAndAllocateForAccount(config, {
      chainId,
      account,
      amount,
      from: walletClient.account.address,
    });
  }

  return walletClient.writeContract({
    address: addresses.accountLayerAddress,
    abi: accountLayerAbi,
    functionName: "depositAndAllocateForAccount",
    args: [account, amount],
    account: walletClient.account,
    chain: walletClient.chain,
  });
}
