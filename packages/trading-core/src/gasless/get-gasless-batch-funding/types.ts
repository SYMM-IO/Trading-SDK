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
  /** Uncovered quoted debit, clamped to zero. */
  shortfall18: bigint;
}

/** An advisory funding projection, not a simulation or permission to submit. */
export interface GaslessBatchFunding {
  /** The unmodified fee quote; its payer and charges can change during execution. */
  quote: GaslessFeeQuote;
  /** Whether every positively charged payer covers its own quoted debit after the supplied movements. */
  hasSufficientBalance: boolean;
  /** One row per positively charged payer. Zero-debit payers need no balance read and have no row. */
  payers: readonly GaslessPayerFunding[];
}

/** Return type of {@link getGaslessBatchFunding}. */
export type GetGaslessBatchFundingReturnType = GaslessBatchFunding;
