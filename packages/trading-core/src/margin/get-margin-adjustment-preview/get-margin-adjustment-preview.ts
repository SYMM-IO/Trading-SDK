import { encodeFunctionData, parseUnits, type Address } from "viem";
import type { Config } from "../../core/config";
import { getGaslessFeeQuote } from "../../gasless/get-gasless-fee-quote";
import { GaslessFeeSource, type GaslessFeeQuote } from "../../gasless/types";
import { getDeallocateUpnlSig } from "../../muon/deallocate-upnl-sig";
import { getQuotePendingFunding } from "../../quotes/get-quote-pending-funding";
import { SymmError } from "../../shared/errors/symm-error";
import { mulWei } from "../../shared/utils/wei";
import { buildSignedOperation } from "../../solvers/instant-open/shared/operations";
import { getSymbols } from "../../solvers/symbols/get-symbols";
import { accountLayerAbi } from "../../symmio-contracts/abi/v0.8.6/account-layer";
import { getAccountBalanceInfo } from "../../symmio-contracts/account-layer/actions/get-account-balance-info";
import { getAccountBalanceOf } from "../../symmio-contracts/account-layer/actions/get-account-balance-of";
import { getSubAccount } from "../../symmio-contracts/account-layer/actions/get-sub-account";
import { getVirtualAccount } from "../../symmio-contracts/account-layer/actions/get-virtual-account";
import { simulateAddMargin } from "../../symmio-contracts/account-layer/actions/simulate-add-margin";
import { simulateRemoveMargin } from "../../symmio-contracts/account-layer/actions/simulate-remove-margin";
import type { AccountBalanceInfo, SingleUpnlSig } from "../../symmio-contracts/account-layer/types";
import { getFeeForUser } from "../../symmio-contracts/symmio/actions/get-fee-for-user";
import { getPartyAOpenPositions } from "../../symmio-contracts/symmio/actions/get-party-a-open-positions";
import { isPartyALiquidated } from "../../symmio-contracts/symmio/is-party-a-liquidated";
import {
  calculatePositionLiquidationState,
  type PositionLiquidationState,
} from "../calculate-position-liquidation-state";

/** Identity, live mark and close-reserve policy for a margin preview. */
export interface GetMarginAdjustmentPreviewParameters {
  /** Deployment chain, always explicit for a write preview. */
  chainId: number;
  /** Master wallet whose ownership must match the on-chain subaccount. */
  owner: Address;
  /** Relay signer; does not replace the owner during AccountLayer simulation. */
  signer: Address;
  /** Billing and authority subaccount. */
  subAccount: Address;
  /** Virtual account whose parent must match the subaccount. */
  virtualAccount: Address;
  /** Direction of the collateral transfer. */
  direction: "add" | "remove";
  /** Core-18 input; zero reads limits without simulating a zero write. */
  amount: bigint;
  /** Timestamped mark from the shared price pipeline. */
  mark?: { price: bigint; updatedAt: number };
  /** Maximum acceptable mark age, milliseconds. */
  maxPriceAgeMs: number;
  /** Additional buffer on the estimated close fee, in basis points. */
  closeFeeReserveBufferBps: number;
}

/** Financial values and the fresh simulation required before submitting. */
export interface MarginAdjustmentPreview {
  /** Config and snapshot identity. Never reuse across deployments or owners. */
  snapshotIdentity: string;
  /** Observation time, epoch milliseconds. */
  observedAt: number;
  /** Available parent collateral after the quoted relay debit. */
  availableToAdd: bigint;
  /** Conservative available removal after pending locks and close reserve. */
  maxRemovable: bigint;
  /** Unadjusted on-chain allocated margin, core-18. */
  currentMargin: bigint;
  /** Allocated margin after this amount; absent if out of bounds. */
  resultingMargin?: bigint;
  /** Raw snapshot for optimistic overlays; funding has not been deducted. */
  balance: AccountBalanceInfo;
  /** Parent free collateral before this transfer. */
  parentBalance: bigint;
  /** Parent collateral after the transfer and quoted relay debit. */
  resultingParentBalance?: bigint;
  /** Close-fee reserve including the requested buffer. */
  closeFeeReserve: bigint;
  /** Current VA liquidation domain. */
  currentRisk: PositionLiquidationState;
  /** Resulting domain; absent if the amount is out of bounds. */
  resultingRisk?: PositionLiquidationState;
  /** Estimated gasless debit, never substituted with zero on failure. */
  feeQuote: GaslessFeeQuote;
  /** Zero is not simulated; invalid amounts remain unavailable for writes. */
  simulation: "not-requested" | "out-of-bounds" | "success";
  /** Fresh Muon signature for removal, also used in its simulation. */
  upnlSig: SingleUpnlSig;
}

function fail(message: string): never {
  throw new SymmError("validation", "MARGIN_PREVIEW_UNAVAILABLE", message);
}
function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/**
 * Verify ownership and compose balance, complete VA book, funding, fee, Muon
 * and AccountLayer simulation reads. A failed read rejects the entire preview.
 * The dry-run uses the verified owner; gasless delegation and relay simulation
 * are still checked at submission. No wallet write is performed.
 * @param config - Explicit deployment configuration.
 * @param p - Identity, amount, live mark and reserve policy.
 * @returns Raw core-18 figures and simulation status.
 * @example
 * const preview = await getMarginAdjustmentPreview(config, parameters);
 * if (preview.simulation === "success") showConfirmation(preview);
 */
export async function getMarginAdjustmentPreview(
  config: Config,
  p: GetMarginAdjustmentPreviewParameters,
): Promise<MarginAdjustmentPreview> {
  if (
    p.amount < 0n ||
    !Number.isInteger(p.closeFeeReserveBufferBps) ||
    p.closeFeeReserveBufferBps < 0 ||
    p.closeFeeReserveBufferBps > 10_000
  )
    fail("Invalid margin amount or reserve policy.");
  const { chainId } = p;
  const [sub, va] = await Promise.all([
    getSubAccount(config, { chainId, account: p.subAccount }),
    getVirtualAccount(config, { chainId, account: p.virtualAccount }),
  ]);
  if (
    !sub.isExists ||
    sub.owner.toLowerCase() !== p.owner.toLowerCase() ||
    !va.isExists ||
    va.parentAccount.toLowerCase() !== p.subAccount.toLowerCase()
  )
    fail("Margin account ownership changed.");
  if (sub.symmioCore.toLowerCase() !== config.getChainConfig(chainId).addresses.symmioAddress.toLowerCase())
    fail("Margin account belongs to another deployment.");
  const [balance, parentBalance, quotes, upnlSig, platformFee, symbols, liquidated] = await Promise.all([
    getAccountBalanceInfo(config, { chainId, account: p.virtualAccount }),
    getAccountBalanceOf(config, { chainId, account: p.subAccount }),
    // One on-chain snapshot: never concatenate unstable swap-and-pop pages.
    getPartyAOpenPositions(config, { chainId, partyA: p.virtualAccount, size: 10_000n }),
    getDeallocateUpnlSig(config, { chainId, virtualAccount: p.virtualAccount }),
    getFeeForUser(config, { chainId, user: p.virtualAccount, symbolId: va.symbolId }),
    getSymbols(config, { chainId, symbolId: Number(va.symbolId) }),
    isPartyALiquidated(config, { chainId, partyA: p.virtualAccount }),
  ]);
  if (quotes.length >= 10_000) fail("VA book exceeds preview capacity.");
  const funding = await getQuotePendingFunding(config, { chainId, quoteIds: quotes.map((q) => q.id) });
  if (funding.length !== quotes.length || quotes.some((q) => !funding.some((row) => row.quoteId === q.id)))
    fail("Funding snapshot is incomplete.");
  const unpaidFundingDebt = funding.reduce((sum, row) => sum + max(0n, -row.pendingNetReceived), 0n);
  const observedAt = Date.now();
  const riskInputs = {
    positionId: quotes[0]?.id ?? 0n,
    account: p.virtualAccount,
    positions: quotes.map((q) => ({ ...q, account: q.partyA })),
    complete: true,
    balance,
    unpaidFundingDebt,
    liquidated,
    mark: p.mark,
    nowMs: observedAt,
    maxPriceAgeMs: p.maxPriceAgeMs,
  };
  const currentRisk = calculatePositionLiquidationState(riskInputs);
  if (currentRisk.status !== "ready") fail("A complete VA book and fresh mark are required.");
  const symbol = symbols.find((s) => BigInt(s.symbolId) === va.symbolId);
  if (!symbol) fail("Close fee unavailable for this market.");
  const rate = platformFee.closeFee + parseUnits(symbol.hedgerFeeClose, 18);
  if (rate < 0n) fail("Invalid close fee.");
  const quantity = quotes.reduce((sum, q) => sum + q.quantity - q.closedAmount, 0n);
  const closeFee = mulWei(mulWei(quantity, p.mark!.price), rate);
  // Round reserve upward so Max never removes the last fractional fee unit.
  const closeFeeReserve = (closeFee * BigInt(10_000 + p.closeFeeReserveBufferBps) + 9_999n) / 10_000n;
  const locked = balance.lockedCVA + balance.lockedLF + balance.lockedPartyAMM;
  const pending = balance.pendingLockedCVA + balance.pendingLockedLF + balance.pendingLockedPartyAMM;
  // Muon uPnL is already net of pending funding. Only the independent
  // mark-based cushion/free-balance cap needs the explicit debt deduction.
  const allocated = balance.allocatedBalance;
  const availableForQuote =
    upnlSig.upnl >= 0n
      ? allocated + upnlSig.upnl - locked - pending
      : allocated - balance.lockedCVA - balance.lockedLF - pending - max(-upnlSig.upnl, balance.lockedPartyAMM);
  const maxRemovable = max(
    0n,
    min(allocated - unpaidFundingDebt - locked - pending, min(allocated, availableForQuote)) - closeFeeReserve,
  );
  const callData =
    p.direction === "add"
      ? encodeFunctionData({ abi: accountLayerAbi, functionName: "addMargin", args: [p.virtualAccount, p.amount] })
      : encodeFunctionData({
          abi: accountLayerAbi,
          functionName: "removeMargin",
          args: [p.virtualAccount, p.amount, upnlSig],
        });
  const operation = buildSignedOperation({
    signer: p.signer,
    signerAccount: p.subAccount,
    target: config.getChainConfig(chainId).addresses.accountLayerAddress,
    callData,
    deadline: BigInt(Math.floor(observedAt / 1000) + 1200),
  });
  const feeQuote = await getGaslessFeeQuote(config, { chainId, operations: [{ operation }] });
  const parentDebit = feeQuote.payments
    .filter(
      (payment) =>
        payment.source === GaslessFeeSource.SYMMIO_ACCOUNT &&
        payment.payer.toLowerCase() === p.subAccount.toLowerCase(),
    )
    .reduce(
      (sum, payment) =>
        sum +
        payment.operationalFee18 +
        payment.depositFee18 +
        payment.walletCreationFee18 +
        payment.nativeTopUpFee18 +
        payment.nativeGasCollateral18,
      0n,
    );
  const availableToAdd = max(0n, parentBalance - parentDebit);
  const parentAfter = parentBalance + (p.direction === "add" ? -p.amount : p.amount) - parentDebit;
  const valid = p.amount <= (p.direction === "add" ? availableToAdd : maxRemovable) && parentAfter >= 0n;
  let simulation: MarginAdjustmentPreview["simulation"] = p.amount === 0n ? "not-requested" : "out-of-bounds";
  if (valid && p.amount > 0n) {
    const parameters = { chainId, virtualAccount: p.virtualAccount, amount: p.amount, from: p.owner };
    if (p.direction === "add") await simulateAddMargin(config, parameters);
    else await simulateRemoveMargin(config, { ...parameters, upnlSig });
    simulation = "success";
  }
  const resultingMargin = valid ? balance.allocatedBalance + (p.direction === "add" ? p.amount : -p.amount) : undefined;
  if (!p.mark || Date.now() - p.mark.updatedAt >= p.maxPriceAgeMs)
    fail("The mark expired during simulation. Refresh the preview.");
  return {
    snapshotIdentity: `${config.getChainConfigKey(chainId)}:${p.owner.toLowerCase()}:${p.subAccount.toLowerCase()}:${p.virtualAccount.toLowerCase()}:${observedAt}`,
    observedAt,
    availableToAdd,
    maxRemovable,
    currentMargin: balance.allocatedBalance,
    resultingMargin,
    balance,
    parentBalance,
    closeFeeReserve,
    currentRisk,
    feeQuote,
    simulation,
    upnlSig,
    resultingParentBalance: valid ? parentAfter : undefined,
    resultingRisk:
      resultingMargin === undefined
        ? undefined
        : calculatePositionLiquidationState({
            ...riskInputs,
            balance: { ...balance, allocatedBalance: resultingMargin },
          }),
  };
}
