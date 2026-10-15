import type { Config } from "../../core/config";
import type { ReadSolverParameter } from "../../shared/types/properties";
import { getAllSymbols } from "../get-all-symbols/get-all-symbols";
import { collectPages, invalid, readEnigma, record, sumDecimals, symbolId } from "../read";

/** Deployment selection for a complete cap snapshot. */
export type GetNotionalCapSnapshotParameters = ReadSolverParameter;
/** Plain dollar strings; no binary floating-point conversion or 1e18 scaling. */
export interface DecimalNotionalCap {
  /** Absent for a legacy ticker-only row whose identity cannot be resolved uniquely. */
  symbolId?: number;
  symbol: string;
  totalCap: string;
  used: string;
  availableToLong: string;
  availableToShort: string;
  openInterest: string;
  price?: string;
  tokenBalance?: string;
  usdcBalance?: string;
  error: string | null;
}
/** Aggregates are absent if any page omits them. */
export interface GetNotionalCapSnapshotReturnType {
  symbols: DecimalNotionalCap[];
  totalUsed?: string;
  totalOpenInterest?: string;
}
function decimal(value: unknown): string {
  if ((typeof value !== "string" && typeof value !== "number") || !/^-?\d+(?:\.\d+)?$/.test(String(value)))
    invalid("Invalid notional-cap decimal");
  return String(value);
}
/** Fetch all cap pages and sum their exact aggregates, preserving unknown totals. */
export async function getNotionalCapSnapshot(
  config: Config,
  parameters: GetNotionalCapSnapshotParameters = {},
): Promise<GetNotionalCapSnapshotReturnType> {
  const used: (string | undefined)[] = [],
    interest: (string | undefined)[] = [];
  let legacyIds: Map<string, number[]> | undefined;
  const symbols = await collectPages(
    async (offset) => {
      const response = await readEnigma(config, parameters, "/notional_cap", { limit: 100, offset });
      const page = record(response);
      const raw = Array.isArray(response) ? response : page?.symbols;
      if (!Array.isArray(raw)) invalid("Invalid notional-cap page");
      used.push(page?.total_used == null ? undefined : decimal(page.total_used));
      interest.push(page?.total_open_interest == null ? undefined : decimal(page.total_open_interest));
      if (raw.some((value) => symbolId(record(value)?.symbol_id) === undefined) && !legacyIds) {
        legacyIds = new Map();
        for (const market of await getAllSymbols(config, parameters)) {
          if (!market.isValid) continue;
          const key = market.symbol.trim().toUpperCase();
          legacyIds.set(key, [...(legacyIds.get(key) ?? []), market.symbolId]);
        }
      }
      const rows = raw.map((value) => {
        const row = record(value);
        if (!row) invalid("Invalid cap row");
        const ticker = typeof row.symbol === "string" ? row.symbol : "";
        const candidates = legacyIds?.get(ticker.trim().toUpperCase());
        const id = symbolId(row.symbol_id) ?? (candidates?.length === 1 ? candidates[0] : undefined);
        return {
          symbolId: id,
          symbol: ticker,
          totalCap: decimal(row.total_cap),
          used: decimal(row.used),
          availableToLong: decimal(row.available_to_long),
          availableToShort: decimal(row.available_to_short),
          openInterest: decimal(row.open_interest),
          ...(row.price != null ? { price: decimal(row.price) } : {}),
          ...(row.token_balance != null ? { tokenBalance: decimal(row.token_balance) } : {}),
          ...(row.usdc_balance != null ? { usdcBalance: decimal(row.usdc_balance) } : {}),
          error: typeof row.error === "string" ? row.error : null,
        };
      });
      return { rows, count: Array.isArray(response) ? rows.length : Number(page?.count) };
    },
    (row) => row.symbolId,
  );
  return {
    symbols,
    ...(used.every((v): v is string => v !== undefined) ? { totalUsed: sumDecimals(used) } : {}),
    ...(interest.every((v): v is string => v !== undefined) ? { totalOpenInterest: sumDecimals(interest) } : {}),
  };
}
