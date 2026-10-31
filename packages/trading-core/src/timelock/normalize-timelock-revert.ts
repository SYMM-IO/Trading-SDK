import { BaseError, ContractFunctionRevertedError } from "viem";
import { SymmError } from "../shared/errors/symm-error";

/** Map a decoded timelock-gate revert while preserving all other failures. */
export function rethrowTimelockRevert(error: unknown): never {
  const revert =
    error instanceof BaseError ? error.walk((cause) => cause instanceof ContractFunctionRevertedError) : undefined;
  if (
    revert instanceof ContractFunctionRevertedError &&
    revert.data?.errorName === "TimelockOpNotApprovedOrScheduled"
  ) {
    throw new SymmError(
      "validation",
      "TIMELOCK_REQUIRED",
      "This operation requires a timelock approval or a mature schedule.",
      { cause: error },
    );
  }
  throw error;
}
