import type { Address } from "viem";
import type { Config } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import { getGaslessBatchFeeQuote } from "../get-gasless-batch-fee-quote";
import { resolveGaslessService } from "../resolve-gasless";
import { GaslessFeeSource } from "../types";
import { batchFeeApprovals } from "./batch-fee-approvals";
import type {
  GaslessFundingShortage,
  GaslessPayerFunding,
  GetGaslessBatchFundingParameters,
  GetGaslessBatchFundingReturnType,
} from "./types";

function shortfall(needed: bigint, available: bigint): bigint {
  return needed > available ? needed - available : 0n;
}

/**
 * Quote an exact batch and check whether every payer can be charged its fees.
 *
 * Fees are collected after operations, and the GaslessLayer charges a payer only
 * when **both** its Core balance and its operational-fee allowance cover them. So
 * each payer gets two checks and a `missing` list naming which one fails:
 *
 * - **Balance**: free plus allocated Core balance after the batch, against all
 *   quoted fees and native gas collateral. Supply known Core balance movements in
 *   `balanceChanges`; the action does not decode or simulate arbitrary calls.
 * - **Allowance**: the payer's remaining allowance for the GaslessLayer, after
 *   any fee approval in the batch itself, against its operational and
 *   wallet-creation fees.
 *
 * Charges are grouped by their quoted payer, never pooled across accounts. All
 * amounts are internal 18-decimal units. Every payer's balances and allowance use
 * one fresh RPC block number; the fee quote is read separately and is not pinned
 * to that snapshot.
 *
 * This is advisory: allowances, payer selection and balances can change before
 * execution. It does not validate the operation's own spending/risk limits or
 * guarantee relay acceptance. Use a fresh read after reconciling pending work
 * and before a new submission; a cached preview is not a submission guard.
 *
 * @param config - SDK config; no wallet client is needed.
 * @param parameters - Exact relay account/calls, chain and known balance movements.
 * @returns The quote, overall `isCovered`, and per-payer balance and allowance coverage.
 * @throws {SymmError} `GASLESS_FUNDING_SOURCE_UNSUPPORTED` for non-Core fee sources,
 *   or `GASLESS_FUNDING_QUOTE_INCONSISTENT` for inconsistent/negative quoted debits.
 * @throws Quote errors, including `GASLESS_FREE_QUOTA_EXHAUSTED`, and balance- or allowance-read errors unchanged.
 * @example
 * ```ts
 * const funding = await getGaslessBatchFunding(config, { account, calls });
 * for (const payer of funding.payers) {
 *   if (payer.missing.includes("balance")) askForDeposit(payer.payer, payer.shortfall18);
 *   if (payer.missing.includes("allowance")) askForApproval(payer.payer, payer.allowanceShortfall18);
 * }
 * ```
 */
export async function getGaslessBatchFunding(
  config: Config,
  parameters: GetGaslessBatchFundingParameters,
): Promise<GetGaslessBatchFundingReturnType> {
  const { chainId, account, calls, balanceChanges = [] } = parameters;
  const quote = await getGaslessBatchFeeQuote(config, { chainId, account, calls });
  const due = new Map<Address, bigint>();
  const allowanceDue = new Map<Address, bigint>();
  for (const payment of quote.payments) {
    if (payment.source !== GaslessFeeSource.SYMMIO_ACCOUNT) {
      throw new SymmError(
        "validation",
        "GASLESS_FUNDING_SOURCE_UNSUPPORTED",
        "Funding projections require SYMMIO account fee sources.",
      );
    }
    const components = [
      payment.operationalFee18,
      payment.depositFee18,
      payment.walletCreationFee18,
      payment.nativeTopUpFee18,
      payment.nativeGasCollateral18,
    ];
    if (components.some((amount) => amount < 0n)) {
      throw new SymmError("validation", "GASLESS_FUNDING_QUOTE_INCONSISTENT", "Quoted fee debits must be nonnegative.");
    }
    const payer = payment.payer.toLowerCase() as Address;
    due.set(payer, (due.get(payer) ?? 0n) + components.reduce((sum, amount) => sum + amount, 0n));
    // GaslessFeeQuoteLib charges these two through chargeOperationalFee, which spends the allowance.
    allowanceDue.set(payer, (allowanceDue.get(payer) ?? 0n) + payment.operationalFee18 + payment.walletCreationFee18);
  }
  if ([...due.values()].reduce((sum, amount) => sum + amount, 0n) !== quote.totalDebit18) {
    throw new SymmError(
      "validation",
      "GASLESS_FUNDING_QUOTE_INCONSISTENT",
      "Quoted payer debits do not match the total debit.",
    );
  }
  const movements = new Map<Address, bigint>();
  for (const change of balanceChanges) {
    const payer = change.account.toLowerCase() as Address;
    movements.set(payer, (movements.get(payer) ?? 0n) + change.delta18);
  }
  const chargedPayers = [...due].filter(([, debit]) => debit > 0n);
  if (chargedPayers.length === 0) {
    return { quote, hasSufficientBalance: true, hasSufficientAllowance: true, isCovered: true, payers: [] };
  }

  const { gaslessLayerAddress } = resolveGaslessService(config, { chainId });
  const approvals = batchFeeApprovals(account, calls, gaslessLayerAddress);
  const { addresses } = config.getChainConfig(chainId);
  const client = config.getClient({ chainId });
  // quote.blockNumber can be an L1 estimate on Arbitrum, not the RPC's L2 height.
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });
  const readParameters = { address: addresses.symmioAddress, abi: symmioAbi, blockNumber };
  const payers = await Promise.all(
    chargedPayers.map(async ([payer, debit18]): Promise<GaslessPayerFunding> => {
      const [freeBalance18, info, [allowanceBefore18]] = await Promise.all([
        client.readContract({ ...readParameters, functionName: "balanceOf", args: [payer] }),
        client.readContract({ ...readParameters, functionName: "balanceInfoOfPartyA", args: [payer] }),
        client.readContract({
          ...readParameters,
          functionName: "getOperationalFeeAllowance",
          args: [payer, gaslessLayerAddress],
        }),
      ]);
      const balanceBefore18 = freeBalance18 + info[0];
      const projected = balanceBefore18 + (movements.get(payer) ?? 0n);
      const projectedBalance18 = projected > 0n ? projected : 0n;
      const shortfall18 = shortfall(debit18, projectedBalance18);
      const allowanceDebit18 = allowanceDue.get(payer) ?? 0n;
      const allowance18 = approvals.get(payer) ?? allowanceBefore18;
      const allowanceShortfall18 = shortfall(allowanceDebit18, allowance18);
      const missing: GaslessFundingShortage[] = [];
      if (shortfall18 > 0n) missing.push("balance");
      if (allowanceShortfall18 > 0n) missing.push("allowance");
      return {
        payer,
        debit18,
        freeBalance18,
        balanceBefore18,
        projectedBalance18,
        shortfall18,
        allowanceDebit18,
        allowance18,
        allowanceShortfall18,
        missing,
      };
    }),
  );
  const hasSufficientBalance = payers.every((payer) => payer.shortfall18 === 0n);
  const hasSufficientAllowance = payers.every((payer) => payer.allowanceShortfall18 === 0n);
  return {
    quote,
    hasSufficientBalance,
    hasSufficientAllowance,
    isCovered: hasSufficientBalance && hasSufficientAllowance,
    payers,
  };
}
