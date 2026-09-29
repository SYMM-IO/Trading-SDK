import {
  accountLayerAbi,
  getCollateralAllowanceQueryKey,
  getCollateralBalanceQueryKey,
  getDelegationExpiryQueryKey,
  getGaslessBatchSelectors,
  getGaslessDepositPolicyQueryKey,
  getGaslessWalletCreationFeeQueryKey,
  getGaslessWalletNonceQueryKey,
  getInstantLayerNonceQueryKey,
  getIsDelegationActiveQueryKey,
  getLastWithdrawRequestIdQueryKey,
  getOperationalFeeAllowanceQueryKey,
  getPartyAOpenPositionsQueryKey,
  getPartyAPendingQuotesQueryKey,
  getPendingQuotesQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getQuotePendingFundingQueryKey,
  getQuoteQueryKey,
  getSubAccountQueryKey,
  getSubAccountsCountOfUserQueryKey,
  getUserSubAccountsAddressesQueryKey,
  getUserSubAccountsQueryKey,
  getWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  instantLayerAbi,
  symmioAbi,
  type GaslessBatchCall,
} from "@symmio/trading-core";
import type { QueryClient } from "@tanstack/react-query";
import { isAddress, toFunctionSelector, type Abi, type AbiFunction, type Address, type Hex } from "viem";
import { invalidateAccountBalances } from "../utils/invalidate-account-balances";
import { predicateMatch } from "../utils/predicate-match";

/** Chain-config fingerprint every invalidation is scoped by. */
interface Scope {
  configKey?: string;
}

/**
 * The GaslessWallet a relayed action touched, as far as its variables say.
 * Every omitted field matches all of its values — a superset is correct, a
 * silent no-op is not.
 */
interface GaslessWalletScope {
  /** The wallet's owner. */
  owner?: Address;
  /**
   * The wallet's id. `useGaslessWalletExecute` forwards its variables whole, so
   * its `walletId` narrows the invalidation on its own; the settlement hooks
   * take theirs from the acceptance receipt, which is the id the service
   * actually settled. Omitted, every id of the owner matches.
   */
  walletId?: bigint;
}

/**
 * Invalidate what every relayed action changes, whatever the action was.
 *
 * Two facts hold for all of them, because they are properties of the transport
 * rather than of the operation: the GaslessLayer deducts the operational fee
 * from SYMMIO collateral, and it deducts it from an allowance. So balances and
 * the payer's allowance are always stale afterwards.
 *
 * @param queryClient - The active TanStack query client.
 * @param scope - The chain-config fingerprint.
 * @param payer - The sub-account charged, when known; omitted invalidates every payer on the chain.
 *
 * @internal
 */
function invalidateRelayTransportReads(queryClient: QueryClient, scope: Scope, payer?: Address): void {
  invalidateAccountBalances(queryClient, scope);
  void queryClient.invalidateQueries({
    predicate: predicateMatch(getOperationalFeeAllowanceQueryKey, { ...scope, payer }),
  });
}

/**
 * Invalidate the reads that change when a GaslessWallet is deployed.
 *
 * A wallet deploys lazily, on the first settlement or wallet operation that
 * uses it, and from then on its creation fee reads `0n` — which also lowers the
 * deposit policy's `settlementMinimum`. Whether this action was the one that
 * deployed it is unknowable from its variables, so both reads are invalidated
 * after every such action.
 *
 * @internal
 */
function invalidateGaslessWalletDeploymentReads(
  queryClient: QueryClient,
  scope: Scope,
  wallet: GaslessWalletScope,
): void {
  const match = { ...scope, owner: wallet.owner, walletId: wallet.walletId };
  void queryClient.invalidateQueries({ predicate: predicateMatch(getGaslessDepositPolicyQueryKey, match) });
  void queryClient.invalidateQueries({ predicate: predicateMatch(getGaslessWalletCreationFeeQueryKey, match) });
}

/**
 * Invalidate the reads a relayed InstantLayer batch changed.
 *
 * Only transport-level facts: `operationType` is a free-form label the fee
 * policy ignores, so the SDK cannot know which domain reads a batch touched and
 * must not guess. Callers who know the operation pass their own `onSuccess` to
 * `mutate`, which now runs after confirmation.
 *
 * @internal
 */
export function invalidateRelayInstantOperationsReads(
  queryClient: QueryClient,
  scope: Scope,
  signerAccounts: readonly Address[],
): void {
  const accounts = [...new Set(signerAccounts)];
  for (const account of accounts) {
    void queryClient.invalidateQueries({
      predicate: predicateMatch(getInstantLayerNonceQueryKey, { ...scope, account }),
    });
    void queryClient.invalidateQueries({
      predicate: predicateMatch(getOperationalFeeAllowanceQueryKey, { ...scope, payer: account }),
    });
  }
  invalidateAccountBalances(queryClient, scope);
}

/**
 * Invalidate the reads a relayed gasless-wallet `execute` changed.
 *
 * The wallet-operation nonce is keyed by `(owner, walletId, signerAccount)`,
 * and the operation consumed it under its signer account — which defaults to
 * the owner. The wallet's own collateral balance moves, and its address is
 * derived rather than passed, so the collateral read is invalidated chain-wide.
 * The operation may also have deployed the wallet, which zeroes its creation fee.
 *
 * @param wallet - The action's variables, forwarded whole: `owner`, `signerAccount` and `walletId`
 *   scope the invalidation, and each omitted one matches every value.
 *
 * @internal
 */
export function invalidateGaslessWalletExecuteReads(
  queryClient: QueryClient,
  scope: Scope,
  wallet: GaslessWalletScope & { signerAccount?: Address },
): void {
  void queryClient.invalidateQueries({
    predicate: predicateMatch(getGaslessWalletNonceQueryKey, {
      ...scope,
      owner: wallet.owner,
      walletId: wallet.walletId,
      account: wallet.signerAccount ?? wallet.owner,
    }),
  });
  void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralBalanceQueryKey, scope) });
  invalidateGaslessWalletDeploymentReads(queryClient, scope, wallet);
  invalidateRelayTransportReads(queryClient, scope);
}

/** The selector of the first function named `name` in `abi` — the same derivation the SDK's relayable-writes map uses. */
function selectorOf(abi: Abi, name: string): Hex {
  const item = abi.find((entry): entry is AbiFunction => entry.type === "function" && entry.name === name);
  if (!item) throw new Error(`invalidate-relay-reads: the shipped ABI has no function "${name}".`);
  return toFunctionSelector(item);
}

/** Relayable writes that move a withdrawal request along. */
const WITHDRAW_WRITES: ReadonlySet<Hex> = new Set([
  selectorOf(symmioAbi as Abi, "initiateWithdraw"),
  selectorOf(symmioAbi as Abi, "requestCancelWithdraw"),
  selectorOf(symmioAbi as Abi, "finalizeWithdrawRequest"),
]);

/** Relayable writes that change a quote or an open position. */
const QUOTE_WRITES: ReadonlySet<Hex> = new Set([
  selectorOf(symmioAbi as Abi, "requestToCancelQuote"),
  selectorOf(symmioAbi as Abi, "requestToCancelCloseRequest"),
  selectorOf(symmioAbi as Abi, "forceCancelQuote"),
  selectorOf(symmioAbi as Abi, "forceCancelCloseRequest"),
  selectorOf(symmioAbi as Abi, "forceClosePosition"),
]);

/** Relayable writes that change an owner's sub-account list or a sub-account's details. */
const SUB_ACCOUNT_WRITES: ReadonlySet<Hex> = new Set([
  selectorOf(accountLayerAbi as Abi, "createSubAccounts"),
  selectorOf(accountLayerAbi as Abi, "deleteSubAccount"),
  selectorOf(accountLayerAbi as Abi, "editAccountName"),
]);

/** Relayable writes that pull collateral from the signer's own token balance. */
const DEPOSIT_WRITES: ReadonlySet<Hex> = new Set([
  selectorOf(accountLayerAbi as Abi, "depositForAccount"),
  selectorOf(accountLayerAbi as Abi, "depositAndAllocateForAccount"),
]);

/** The one relayable write that grants a delegation. */
const GRANT_DELEGATION = selectorOf(instantLayerAbi as Abi, "grantDelegation");

/**
 * Invalidate the reads a relayed gasless batch changed.
 *
 * Unlike an opaque `relayInstantOperations` batch, every call of a gasless
 * batch is a known relayable write (the SDK refuses anything else), so its
 * selectors say exactly which domains moved. Each domain's reads are
 * invalidated chain-wide — the calls' own arguments name the rows, but a
 * superset is correct and a silent no-op is not.
 *
 * Always: the account's InstantLayer nonce, fee allowances and balances. Per
 * GaslessWallet entry: that wallet's nonce, collateral and deployment reads.
 *
 * @param batch - The batch's variables: its `account` and `calls`.
 *
 * @internal
 */
export function invalidateGaslessBatchReads(
  queryClient: QueryClient,
  scope: Scope,
  batch: { account: Address; calls: readonly GaslessBatchCall[] },
): void {
  const selectors = new Set(getGaslessBatchSelectors(batch.calls));
  const touches = (writes: ReadonlySet<Hex>) => [...writes].some((selector) => selectors.has(selector));

  void queryClient.invalidateQueries({
    predicate: predicateMatch(getInstantLayerNonceQueryKey, { ...scope, account: batch.account }),
  });
  invalidateRelayTransportReads(queryClient, scope);

  for (const call of batch.calls) {
    if ("walletCalls" in call) {
      invalidateGaslessWalletExecuteReads(queryClient, scope, {
        walletId: call.walletId ?? 0n,
        signerAccount: batch.account,
      });
    }
  }

  if (touches(WITHDRAW_WRITES)) {
    for (const queryKey of [
      getPendingWithdrawRequestsQueryKey,
      getLastWithdrawRequestIdQueryKey,
      getWithdrawableTimeQueryKey,
      getWithdrawRequestsQueryKey,
    ]) {
      void queryClient.invalidateQueries({ predicate: predicateMatch(queryKey, scope) });
    }
  }
  if (touches(QUOTE_WRITES)) {
    for (const queryKey of [
      getPartyAPendingQuotesQueryKey,
      getPendingQuotesQueryKey,
      getQuoteQueryKey,
      getPartyAOpenPositionsQueryKey,
      getQuotePendingFundingQueryKey,
    ]) {
      void queryClient.invalidateQueries({ predicate: predicateMatch(queryKey, scope) });
    }
  }
  if (touches(SUB_ACCOUNT_WRITES)) {
    for (const queryKey of [
      getUserSubAccountsQueryKey,
      getUserSubAccountsAddressesQueryKey,
      getSubAccountsCountOfUserQueryKey,
      getSubAccountQueryKey,
    ]) {
      void queryClient.invalidateQueries({ predicate: predicateMatch(queryKey, scope) });
    }
  }
  if (touches(DEPOSIT_WRITES)) {
    void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralBalanceQueryKey, scope) });
    void queryClient.invalidateQueries({ predicate: predicateMatch(getCollateralAllowanceQueryKey, scope) });
  }
  if (selectors.has(GRANT_DELEGATION)) {
    /** Scoped by config only: one grant covers every selector it lists, for every delegate. */
    void queryClient.invalidateQueries({ predicate: predicateMatch(getIsDelegationActiveQueryKey, scope) });
    void queryClient.invalidateQueries({ predicate: predicateMatch(getDelegationExpiryQueryKey, scope) });
  }
}

/**
 * Invalidate the reads a deposit settlement changed.
 *
 * The deposit address is swept to zero, so its collateral balance is
 * invalidated precisely when the acceptance receipt carries it. The settlement
 * deploys the wallet on its first use, which zeroes the wallet's creation fee
 * and lowers its deposit policy's `settlementMinimum`, so both are invalidated
 * for the owner's wallet.
 *
 * `depositAddress` arrives as the vendor's raw string, so a value that is not a
 * well-formed address widens to a chain-wide collateral invalidation rather
 * than scoping to nothing — a superset is correct, a silent no-op is not.
 *
 * @param options.owner - The settled wallet's owner.
 * @param options.newAccount - `true` for a new-account settlement, which also
 *   refreshes the owner's sub-account lists; omit for a top-up into an existing account.
 *
 * @internal
 */
export function invalidateDepositSettlementReads(
  queryClient: QueryClient,
  scope: Scope,
  options: GaslessWalletScope & { depositAddress?: string; newAccount?: boolean },
): void {
  const depositAddress =
    options.depositAddress && isAddress(options.depositAddress) ? options.depositAddress : undefined;
  void queryClient.invalidateQueries({
    predicate: predicateMatch(getCollateralBalanceQueryKey, { ...scope, owner: depositAddress }),
  });
  if (options.newAccount && options.owner) {
    const user = { ...scope, user: options.owner };
    void queryClient.invalidateQueries({ predicate: predicateMatch(getUserSubAccountsQueryKey, user) });
    void queryClient.invalidateQueries({ predicate: predicateMatch(getUserSubAccountsAddressesQueryKey, user) });
    void queryClient.invalidateQueries({ predicate: predicateMatch(getSubAccountsCountOfUserQueryKey, user) });
  }
  invalidateGaslessWalletDeploymentReads(queryClient, scope, options);
  invalidateAccountBalances(queryClient, scope);
}
