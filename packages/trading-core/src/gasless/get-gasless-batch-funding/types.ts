import type { Address } from "viem";
import type { Compute } from "../../shared/types/properties";
import type { GetGaslessBatchFeeQuoteParameters } from "../get-gasless-batch-fee-quote";
import type { GaslessFeeQuote } from "../types";

/** A known Core balance movement completed before the gateway collects its fees. */
export interface GaslessFundingBalanceChange {
  /** Account whose free plus allocated Core balance changes. */
  account: Address;
  /** Signed change in internal 18-decimal units; negative means funds leave the account. */
  delta18: bigint;
}

/** Parameters for {@link getGaslessBatchFunding}. */
export type GetGaslessBatchFundingParameters = Compute<
  GetGaslessBatchFeeQuoteParameters & {
    /**
     * Explicit post-operation balance projections. Repeated accounts are summed,
     * case-insensitively. Omit for operations that do not move Core balances.
     * The SDK does not infer these movements or simulate arbitrary calldata.
     */
    balanceChanges?: readonly GaslessFundingBalanceChange[];
  }
>;

/**
 * Why a payer cannot be charged its quoted fees.
 * - `"balance"`: its free plus allocated Core balance after the batch is too low — deposit, or pay another way.
 * - `"allowance"`: its operational-fee allowance for the GaslessLayer is too low — approve a larger allowance.
 */
export type GaslessFundingShortage = "balance" | "allowance";

/** Coverage for one positively charged payer. Every amount is in Core 18-decimal units. */
export interface GaslessPayerFunding {
  /** The quote's actual payer, normalized to a lowercase address. */
  payer: Address;
  /** Sum of all quoted fee components and native gas collateral for this payer. */
  debit18: bigint;
  /** Current free Core balance, before the supplied movements. */
  freeBalance18: bigint;
  /** Current free plus allocated Core balance, before the supplied movements. */
  balanceBefore18: bigint;
  /** Free plus allocated balance after supplied movements, clamped to zero. */
  projectedBalance18: bigint;
  /** Balance shortfall: `debit18` above `projectedBalance18`, clamped to zero. */
  shortfall18: bigint;
  /**
   * The part of `debit18` the GaslessLayer charges against the payer's allowance:
   * its operational and wallet-creation fees. Native gas collateral and top-up
   * fees are not allowance-bound.
   */
  allowanceDebit18: bigint;
  /**
   * The payer's remaining operational-fee allowance for the GaslessLayer, read at
   * the same block as the balances, after the batch's own fee approvals. Core's
   * view already applies a ready timelocked reduction; an approval in the batch
   * sets the amount it names, so a reduction there is treated as immediate.
   */
  allowance18: bigint;
  /** Allowance shortfall: `allowanceDebit18` above `allowance18`, clamped to zero. */
  allowanceShortfall18: bigint;
  /** Why this payer cannot be charged, in a fixed order (`"balance"` first). Empty when it is covered. */
  missing: readonly GaslessFundingShortage[];
}

/** An advisory funding projection, not a simulation or permission to submit. */
export interface GaslessBatchFunding {
  /** The unmodified fee quote; its payer and charges can change during execution. */
  quote: GaslessFeeQuote;
  /**
   * Whether every positively charged payer covers its own quoted debit after the
   * supplied movements. Balance only: prefer {@link GaslessBatchFunding.isCovered}.
   */
  hasSufficientBalance: boolean;
  /** Whether every positively charged payer's allowance covers its allowance-bound fees. */
  hasSufficientAllowance: boolean;
  /**
   * Whether every quoted fee can be charged: both balance and allowance suffice
   * for every payer, as the GaslessLayer requires. Each payer's `missing` says why not.
   */
  isCovered: boolean;
  /** One row per positively charged payer. Zero-debit payers need no balance read and have no row. */
  payers: readonly GaslessPayerFunding[];
}

/** Return type of {@link getGaslessBatchFunding}. */
export type GetGaslessBatchFundingReturnType = GaslessBatchFunding;
