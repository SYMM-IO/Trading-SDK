import type { Address, Hex } from "viem";
import type { Config } from "../../core/config";
import type { ChainIdParameter, Compute, GaslessIdempotencyKeyParameter } from "../../shared/types/properties";
import type { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { getGaslessWalletAddress } from "../get-gasless-wallet-address/get-gasless-wallet-address";
import { postGaslessSubmit, resolveGaslessHttp } from "../http";
import { resolveGaslessIdempotencyKey } from "../idempotency-key";
import { assertGaslessDepositWallet, toGaslessDepositReceipt } from "../to-gasless-deposit-receipt";
import type { GaslessDepositSubmitReceipt } from "../types";
import { assertGaslessWalletId, toGaslessWalletIdWire } from "../wallet-id";
import type { GaslessWireDepositAccepted, GaslessWireNewAccountSettlementRequest } from "../wire-types";

/** Path the new-account settlement submits to, under the deposits service base. */
const SETTLE_NEW_ACCOUNT_PATH = "/deposit-settlements/new-account";

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
  /**
   * Metadata forwarded to the affiliate's `onAccountCreation` hook. Defaults to `0x`, which a hooked affiliate
   * rejects with `HookFailed`; build it with `encodeSubAccountHookMetadata`.
   */
  metadata?: Hex;
}

/**
 * Parameters for {@link settleGaslessDepositNewAccount}.
 */
export type SettleGaslessDepositNewAccountParameters = Compute<
  ChainIdParameter &
    GaslessIdempotencyKeyParameter & {
      /**
       * Owner of the GaslessWallet whose deposit address is being settled — an
       * owner address, never a GaslessWallet address. The new sub-account is
       * created for this owner.
       */
      owner: Address;
      /**
       * Which of the owner's GaslessWallets to sweep. Defaults to `0n`, the
       * original wallet. Each id has its own deposit address and its own balance:
       * settle the id you funded, and read that id's address with
       * `getGaslessWalletAddress` before sending anything to it.
       */
      walletId?: bigint;
      /** Affiliate passed to `settleDepositToNewAccount`; the zero address disables attribution. */
      affiliate: Address;
      /** Creation data for the new wallet-owned sub-account. */
      accountData: GaslessDepositAccountData;
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
 * selected wallet's deposit address, deducts the flat fee, creates the
 * sub-account, and credits the net amount — paying all gas itself. The worker
 * re-checks balance, fee, and minimum before broadcast, so an accepted
 * settlement can still turn `rejected` (funds not yet visible, or moved). Poll
 * with `service: "deposits"`. A `succeeded` settlement is not instantly
 * readable — wait until the sub-account and its balance appear on-chain before
 * flipping the UI.
 *
 * The wallet's deterministic address is read **before** the submit and checked
 * against the acceptance, so a settlement that would sweep a different wallet
 * than the one you funded surfaces as an error instead of moving funds
 * silently. A sweep takes the whole balance of the selected id, so give a
 * deposit flow its own id when it must not share a balance with another flow.
 *
 * `idempotencyKey` is one key per **user action** (default: a random UUID per
 * call). Resubmitting under it returns the existing record; a settlement that
 * reached a terminal status is over, so settling again is a new action with a
 * new key. A settlement carries no signature deadline: its outcome is bounded by
 * the deposit wallet's balance instead.
 *
 * @param config - The SDK config.
 * @param parameters - Owner, optional wallet id, affiliate, account creation data, idempotency key.
 * @returns The acceptance receipt (with the observed/credited estimates); persist `requestId`.
 * @throws {SymmError} `GASLESS_IDEMPOTENCY_KEY_INVALID` for a blank key or one longer than 128 characters.
 * @throws {SymmError} `GASLESS_NOT_CONFIGURED` / `GASLESS_UNSUPPORTED_CONTRACTS_VERSION`.
 * @throws {SymmError} `GASLESS_WALLET_ID_INVALID` for a wallet id outside the `uint256` range.
 * @throws {SymmApiError} `GASLESS_SETTLEMENT_SUBMIT_FAILED` on HTTP failure —
 *   `DEPOSIT_BELOW_MINIMUM` in the vendor detail means the address is not
 *   funded to the settlement minimum yet.
 * @throws {SymmApiError} `GASLESS_SUBMIT_UNCONFIRMED` when the outcome could not be
 *   established; `responseData` is the replayable submit, for `resubmitGaslessRequest`.
 * @throws {SymmApiError} `GASLESS_DEPOSIT_WALLET_MISMATCH` when the acceptance names
 *   another wallet or deposit address. The request is already accepted, so the
 *   error carries the parsed receipt (with its `requestId`) as `responseData`.
 *
 * @example
 * ```ts
 * const receipt = await settleGaslessDepositNewAccount(config, {
 *   owner,
 *   walletId: 1n,
 *   affiliate: zeroAddress,
 *   accountData: { name: "Main", isolationType: SubAccountIsolationType.MARKET_DIRECTION, singleVAMode: true },
 * });
 * ```
 */
export async function settleGaslessDepositNewAccount(
  config: Config,
  parameters: SettleGaslessDepositNewAccountParameters,
): Promise<SettleGaslessDepositNewAccountReturnType> {
  const { chainId, owner, affiliate, accountData, metadata } = parameters;
  const idempotencyKey = resolveGaslessIdempotencyKey(parameters.idempotencyKey);
  const walletId = assertGaslessWalletId(parameters.walletId ?? 0n);
  const context = resolveGaslessHttp(config, { chainId, service: "deposits" });

  const body: GaslessWireNewAccountSettlementRequest = {
    idempotencyKey,
    owner,
    walletId: toGaslessWalletIdWire(walletId),
    affiliate,
    accountData: {
      name: accountData.name,
      metadata: accountData.metadata ?? "0x",
      isolationType: accountData.isolationType,
      singleVAMode: accountData.singleVAMode,
    },
    ...(metadata !== undefined ? { metadata } : {}),
  };

  /** Read before the submit: the acceptance is verified against it, and a failed read must not follow a 202. */
  const depositAddress = await getGaslessWalletAddress(config, { chainId, owner, walletId });

  const raw = await postGaslessSubmit<GaslessWireDepositAccepted>(
    context,
    SETTLE_NEW_ACCOUNT_PATH,
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
    path: SETTLE_NEW_ACCOUNT_PATH,
  });
  return receipt;
}
