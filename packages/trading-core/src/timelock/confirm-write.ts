import type { Hash } from "viem";
import type { Config } from "../core/config";
import { confirmGaslessRequest } from "../gasless/confirm-gasless-request";
import { getGaslessWriteRequest } from "../gasless/write-request-registry";
import { SymmError } from "../shared/errors/symm-error";

/** Confirm the original wallet hash or relay request, never submit a replacement operation. @internal */
export async function confirmTimelockWrite(config: Config, chainId: number | undefined, hash: Hash) {
  const relayed = getGaslessWriteRequest(config, { hash });
  const receipt = relayed
    ? (
        await confirmGaslessRequest(config, {
          chainId: relayed.chainId,
          requestId: relayed.requestId,
          service: relayed.service,
          until: "receipt",
        })
      ).receipt
    : await config.getClient({ chainId }).waitForTransactionReceipt({ hash });
  if (!receipt || receipt.status !== "success")
    throw new SymmError("validation", "TIMELOCK_TRANSACTION_REVERTED", "The timelock transaction did not succeed.");
  return receipt;
}
