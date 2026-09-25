import { confirmGaslessRequest, getGaslessWriteRequest, type Config } from "@symmio/trading-core";
import type { Hash, TransactionReceipt } from "viem";

/** Wait for a submitted contract write and reject a reverted receipt. */
export async function confirmTransaction(
  config: Config,
  chainId: number,
  pending: Promise<Hash>,
): Promise<{ hash: Hash; receipt?: TransactionReceipt }> {
  const hash = await pending;
  const relayed = getGaslessWriteRequest(config, { hash });
  if (relayed) {
    const confirmed = await confirmGaslessRequest(config, {
      chainId: relayed.chainId,
      requestId: relayed.requestId,
      service: relayed.service,
      until: "receipt",
    });
    return { hash: confirmed.txHash, receipt: confirmed.receipt };
  }
  const receipt = await config.getClient({ chainId }).waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted.`);
  return { hash, receipt };
}
