import type { Address } from "viem";
import type { Compute } from "../../shared/types/properties";
import type { GaslessBatchFunding, GetGaslessBatchFundingParameters } from "../get-gasless-batch-funding/types";

/** Parameters for {@link getGaslessMarginFunding}. */
export type GetGaslessMarginFundingParameters = Compute<
  Omit<GetGaslessBatchFundingParameters, "balanceChanges"> & {
    /** The virtual account's parent subaccount. May differ from the relay `account` for protected calls. */
    parentAccount: Address;
    /** Virtual account whose margin changes. */
    virtualAccount: Address;
    /** `add` transfers parent funds to the VA; `remove` transfers VA funds back to the parent. */
    direction: "add" | "remove";
    /** Positive margin amount in internal 18-decimal Core units. Must match the supplied calls. */
    amount18: bigint;
  }
>;

/** Margin-specific fee coverage; it does not replace margin/risk or removal-capacity validation. */
export interface GaslessMarginFunding extends GaslessBatchFunding {
  /**
   * Fee-safe add bound when the parent is short of **balance** on an add, otherwise `null`.
   * An allowance shortfall gets no bound: no add amount fixes it.
   * Capped by the parent's free balance; computed with the current quoted fee.
   * Changing the amount requires re-quoting. This is not a guaranteed executable Max.
   */
  maxAddAmount18: bigint | null;
}

/** Return type of {@link getGaslessMarginFunding}. */
export type GetGaslessMarginFundingReturnType = GaslessMarginFunding;
