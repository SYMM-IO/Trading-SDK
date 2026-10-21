import type { Config } from "../../core/config";
import type { PoolTransactionPage } from "../types";
import { getPoolTransactions, type GetPoolTransactionsParameters } from "./get-pool-transactions";

/** Read a requested history range through the service's 50-row page cap. Stop on a short page or the reported total. */
export async function getPoolTransactionRange(
  config: Config,
  parameters: GetPoolTransactionsParameters,
): Promise<PoolTransactionPage> {
  const { start = 0, size = 50 } = parameters;
  const first = await getPoolTransactions(config, { ...parameters, start, size: Math.min(size, 50) });
  const items = [...first.items];
  let previousLength = first.items.length;
  let previousLimit = Math.min(size, 50);
  while (
    previousLength === previousLimit &&
    previousLimit > 0 &&
    items.length < size &&
    start + items.length < first.count
  ) {
    previousLimit = Math.min(size - items.length, 50);
    const page = await getPoolTransactions(config, { ...parameters, start: start + items.length, size: previousLimit });
    previousLength = page.items.length;
    items.push(...page.items);
  }
  return { ...first, items };
}
