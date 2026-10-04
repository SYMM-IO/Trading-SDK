import type { Address } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { getGaslessWalletAddress } from "../get-gasless-wallet-address/get-gasless-wallet-address";
import { generateGaslessIdempotencyKey, postGaslessSubmit, resolveGaslessHttp } from "../http";
import { assertGaslessDepositWallet, toGaslessDepositReceipt } from "../to-gasless-deposit-receipt";
import type { GaslessDepositSubmitReceipt } from "../types";
import { assertGaslessWalletId, toGaslessWalletIdWire } from "../wallet-id";
import type { GaslessWireDepositAccepted, GaslessWireExistingAccountSettlementRequest } from "../wire-types";

/** Path the existing-account settlement submits to, under the deposits service base. */
const SETTLE_EXISTING_ACCOUNT_PATH = "/deposit-settlements/existing-account";

/**
 * Parameters for {@link settleGaslessDepositExistingAccount}.
 */
export type SettleGaslessDepositExistingAccountParameters = Compute<
  ChainIdParameter & {
    /**
     * Owner of the GaslessWallet whose deposit address is being settled — an
     * owner address, never a GaslessWallet address.
     */
    owner: Address;
    /**
     * Which of the owner's GaslessWallets to sweep. Defaults to `0n`, the
     * original wallet. Each id has its own deposit address and balance.
     */
    walletId?: bigint;
    /** The existing wallet-owned sub-account to credit; the gateway verifies ownership. */
    subAccount: Address;
    /**
     * Stable retry key; defaults to a random UUID.
     *
     * **One key per settlement attempt.** Reuse it only to replay a submit
     * whose response was lost — the service then returns the existing record.
     * A **completed** settlement's key must never be reused: mint a fresh one
     * after any terminal status, and after any change to the wallet selection,
     * or the service answers `409 IDEMPOTENCY_KEY_CONFLICT`
     * (`isGaslessIdempotencyConflictError`).
     */
    idempotencyKey?: string;
  }
>;

/** Return type of {@link settleGaslessDepositExistingAccount}. */
export type SettleGaslessDepositExistingAccountReturnType = GaslessDepositSubmitReceipt;

/**
 * Queue the sweep of an owner's deposit address into an **existing**
 * wallet-owned sub-account (a gasless top-up).
 *
 * Same lifecycle as the new-account settlement: the entire observed balance of
 * the selected wallet settles, the flat fee is deducted, and the worker's
 * pre-broadcast re-check can still turn an accepted settlement `rejected`. Poll
 * with `service: "deposits"`. The wallet's deterministic address is read before
 * the submit and checked against the acceptance.
 *
 * @param config - The SDK config.
 * @param parameters - Owner, optional wallet id, target sub-account, retry key.
 * @returns The acceptance receipt; persist `requestId`.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a wallet id outside the `uint256` range.
 * @throws {SymmApiError} `GASLESS_SETTLEMENT_SUBMIT_FAILED` on HTTP failure.
 * @throws {SymmApiError} `GASLESS_SUBMIT_UNCONFIRMED` when the outcome could not be
 *   established; `responseData` is the replayable submit, for `resubmitGaslessRequest`.
 * @throws {SymmApiError} `GASLESS_DEPOSIT_WALLET_MISMATCH` when the acceptance names
 *   another wallet or deposit address, with the parsed receipt as `responseData`.
 *
 * @example
 * ```ts
 * const receipt = await settleGaslessDepositExistingAccount(config, {
 *   owner,
 *   walletId: 1n,
 *   subAccount,
 * });
 * ```
 */
export async function settleGaslessDepositExistingAccount(
  config: Config,
  parameters: SettleGaslessDepositExistingAccountParameters,
): Promise<SettleGaslessDepositExistingAccountReturnType> {
  const { chainId, owner, subAccount } = parameters;
  const walletId = assertGaslessWalletId(parameters.walletId ?? 0n);
  const context = resolveGaslessHttp(config, { chainId, service: "deposits" });
  const idempotencyKey = parameters.idempotencyKey ?? generateGaslessIdempotencyKey();

  const body: GaslessWireExistingAccountSettlementRequest = {
    idempotencyKey,
    owner,
    walletId: toGaslessWalletIdWire(walletId),
    subAccount,
  };

  /** Read before the submit: the acceptance is verified against it, and a failed read must not follow a 202. */
  const depositAddress = await getGaslessWalletAddress(config, { chainId, owner, walletId });

  const raw = await postGaslessSubmit<GaslessWireDepositAccepted>(
    context,
    SETTLE_EXISTING_ACCOUNT_PATH,
    body,
    idempotencyKey,
  );

  const receipt = toGaslessDepositReceipt(raw, {
    owner,
    walletId,
    idempotencyKey,
    protocolInstance: context.protocolInstance,
  });
  assertGaslessDepositWallet(receipt, {
    walletId,
    depositAddress,
    url: context.baseURL,
    path: SETTLE_EXISTING_ACCOUNT_PATH,
  });
  return receipt;
}
