import type { Address, Hex } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import type { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { gaslessPost, generateGaslessIdempotencyKey, isRetryableGaslessSubmitError, resolveGaslessHttp } from "../http";
import { toGaslessDepositReceipt } from "../to-gasless-deposit-receipt";
import type { GaslessDepositSubmitReceipt } from "../types";
import type { GaslessWireDepositAccepted, GaslessWireNewAccountSettlementRequest } from "../wire-types";

/**
 * Creation data for the sub-account a new-account settlement creates.
 *
 * `isolationType` and `singleVAMode` are deliberately **required**: they are
 * product decisions (the lowcap flow uses `MARKET_DIRECTION` with
 * `singleVAMode: true`; majors differ), and the service-side defaults would be
 * silently wrong for either product. There is no `symmioCore` field — the
 * gateway overwrites it with its configured core.
 */
export interface GaslessDepositAccountData {
  /** Sub-account name, 1–64 characters. */
  name: string;
  /** Sub-account isolation strategy — a product decision, choose explicitly. */
  isolationType: SubAccountIsolationType;
  /** Whether the account runs in single-VA mode — a product decision, choose explicitly. */
  singleVAMode: boolean;
  /** Optional hex metadata (affiliate hooks may expect a specific encoding). Defaults to `0x`. */
  metadata?: Hex;
}

/**
 * Parameters for {@link settleGaslessDepositNewAccount}.
 */
export type SettleGaslessDepositNewAccountParameters = Compute<
  ChainIdParameter & {
    /** Owner wallet whose deterministic deposit address is being settled. */
    wallet: Address;
    /** Affiliate passed to `settleDepositToNewAccount`; the zero address disables attribution. */
    affiliate: Address;
    /** Creation data for the new wallet-owned sub-account. */
    accountData: GaslessDepositAccountData;
    /** Stable retry key. A **completed** settlement's key must never be reused — mint a fresh one per attempt after any terminal status. */
    idempotencyKey?: string;
    /** Non-secret client correlation data stored with the request. */
    metadata?: Record<string, unknown>;
  }
>;

/** Return type of {@link settleGaslessDepositNewAccount}. */
export type SettleGaslessDepositNewAccountReturnType = GaslessDepositSubmitReceipt;

/**
 * Queue the sweep of an owner's deposit address into a **new** wallet-owned
 * sub-account.
 *
 * The gateway settles the **entire observed collateral balance** at the
 * deposit address, deducts the flat fee, creates the sub-account, and credits
 * the net amount — paying all gas itself. The worker re-checks balance, fee,
 * and minimum before broadcast, so an accepted settlement can still turn
 * `rejected` (funds not yet visible, or moved). Poll with
 * `service: "deposits"`. A `succeeded` settlement is not instantly readable —
 * wait until the sub-account and its balance appear on-chain before flipping
 * the UI.
 *
 * @param config - The SDK config.
 * @param parameters - Wallet, affiliate, account creation data, retry key.
 * @returns The acceptance receipt (with the observed/credited amounts); persist `requestId`.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmApiError} `GASLESS_SETTLEMENT_SUBMIT_FAILED` on HTTP failure —
 *   `DEPOSIT_BELOW_MINIMUM` in the vendor detail means the address is not
 *   funded to the settlement minimum yet.
 *
 * @example
 * ```ts
 * const receipt = await settleGaslessDepositNewAccount(config, {
 *   wallet: owner,
 *   affiliate: zeroAddress,
 *   accountData: { name: "Main", isolationType: SubAccountIsolationType.MARKET_DIRECTION, singleVAMode: true },
 * });
 * ```
 */
export async function settleGaslessDepositNewAccount(
  config: Config,
  parameters: SettleGaslessDepositNewAccountParameters,
): Promise<SettleGaslessDepositNewAccountReturnType> {
  const { chainId, wallet, affiliate, accountData, metadata } = parameters;
  const context = resolveGaslessHttp(config, { chainId, service: "deposits" });
  const idempotencyKey = parameters.idempotencyKey ?? generateGaslessIdempotencyKey();

  const body: GaslessWireNewAccountSettlementRequest = {
    idempotencyKey,
    wallet,
    affiliate,
    accountData: {
      name: accountData.name,
      metadata: accountData.metadata ?? "0x",
      isolationType: accountData.isolationType,
      singleVAMode: accountData.singleVAMode,
    },
    ...(metadata !== undefined ? { metadata } : {}),
  };

  let raw: GaslessWireDepositAccepted;
  try {
    raw = await gaslessPost<GaslessWireDepositAccepted>(
      context,
      "/deposit-settlements/new-account",
      body,
      "GASLESS_SETTLEMENT_SUBMIT_FAILED",
    );
  } catch (err) {
    if (!isRetryableGaslessSubmitError(err)) throw err;
    raw = await gaslessPost<GaslessWireDepositAccepted>(
      context,
      "/deposit-settlements/new-account",
      body,
      "GASLESS_SETTLEMENT_SUBMIT_FAILED",
    );
  }
  return toGaslessDepositReceipt(raw);
}
