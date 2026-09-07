import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { gaslessPost, generateGaslessIdempotencyKey, isRetryableGaslessSubmitError, resolveGaslessHttp } from "../http";
import { toGaslessDepositReceipt } from "../to-gasless-deposit-receipt";
import type { GaslessDepositSubmitReceipt } from "../types";
import type { GaslessWireDepositAccepted, GaslessWireExistingAccountSettlementRequest } from "../wire-types";

/**
 * Parameters for {@link settleGaslessDepositExistingAccount}.
 */
export type SettleGaslessDepositExistingAccountParameters = Compute<
  ChainIdParameter & {
    /** Owner wallet whose deterministic deposit address is being settled. */
    wallet: Address;
    /** The existing wallet-owned sub-account to credit; the gateway verifies ownership. */
    subAccount: Address;
    /** Stable retry key. A **completed** settlement's key must never be reused — mint a fresh one per attempt after any terminal status. */
    idempotencyKey?: string;
  }
>;

/** Return type of {@link settleGaslessDepositExistingAccount}. */
export type SettleGaslessDepositExistingAccountReturnType = GaslessDepositSubmitReceipt;

/**
 * Queue the sweep of an owner's deposit address into an **existing**
 * wallet-owned sub-account (a gasless top-up).
 *
 * Same lifecycle as the new-account settlement: the entire observed balance
 * settles, the flat fee is deducted, and the worker's pre-broadcast re-check
 * can still turn an accepted settlement `rejected`. Poll with
 * `service: "deposits"`.
 *
 * @param config - The SDK config.
 * @param parameters - Wallet, target sub-account, retry key.
 * @returns The acceptance receipt; persist `requestId`.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmApiError} `GASLESS_SETTLEMENT_SUBMIT_FAILED` on HTTP failure.
 *
 * @example
 * ```ts
 * const receipt = await settleGaslessDepositExistingAccount(config, {
 *   wallet: owner,
 *   subAccount,
 * });
 * ```
 */
export async function settleGaslessDepositExistingAccount(
  config: Config,
  parameters: SettleGaslessDepositExistingAccountParameters,
): Promise<SettleGaslessDepositExistingAccountReturnType> {
  const { chainId, wallet, subAccount } = parameters;
  const context = resolveGaslessHttp(config, { chainId, service: "deposits" });
  const idempotencyKey = parameters.idempotencyKey ?? generateGaslessIdempotencyKey();

  const body: GaslessWireExistingAccountSettlementRequest = {
    idempotencyKey,
    wallet,
    subAccount,
  };

  let raw: GaslessWireDepositAccepted;
  try {
    raw = await gaslessPost<GaslessWireDepositAccepted>(
      context,
      "/deposit-settlements/existing-account",
      body,
      "GASLESS_SETTLEMENT_SUBMIT_FAILED",
    );
  } catch (err) {
    if (!isRetryableGaslessSubmitError(err)) throw err;
    raw = await gaslessPost<GaslessWireDepositAccepted>(
      context,
      "/deposit-settlements/existing-account",
      body,
      "GASLESS_SETTLEMENT_SUBMIT_FAILED",
    );
  }
  return toGaslessDepositReceipt(raw);
}
