import type { Config } from "../../core/config";
import type { ReadSolverParameter } from "../../shared/types/properties";
import { finite, invalid, readEnigma, record, symbolId } from "../read";

/** Explicit deployment/solver selection for symbol-ID volume reads. */
export type GetEnigmaMarketInfoParameters = ReadSolverParameter;
/** Dollar values keyed by protocol symbol ID; aggregates are excluded. */
export type GetEnigmaMarketInfoReturnType = Record<number, { tradingVolume: number; lifetimeValue: number }>;
/** Read Enigma `/market-info` without collapsing markets that share a ticker. */
export async function getEnigmaMarketInfo(
  config: Config,
  parameters: GetEnigmaMarketInfoParameters = {},
): Promise<GetEnigmaMarketInfoReturnType> {
  const data = record(await readEnigma(config, parameters, "/market-info"));
  if (!data) invalid("Invalid market-info response");
  const result: GetEnigmaMarketInfoReturnType = {};
  for (const [key, value] of Object.entries(data)) {
    const id = symbolId(key);
    const row = record(value);
    if (id !== undefined && row)
      result[id] = { tradingVolume: finite(row.trading_volume), lifetimeValue: finite(row.lifetime_value) };
  }
  return result;
}
