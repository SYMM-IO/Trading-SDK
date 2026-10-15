import type { Config } from "../../core/config";
import type { ReadSolverParameter } from "../../shared/types/properties";
import { toSolverSymbols } from "../../solvers/symbols/to-solver-symbol";
import type { SolverSymbol } from "../../solvers/symbols/types";
import { collectPages, invalid, readEnigma, record } from "../read";

/** Deployment selection; all valid symbols are returned in solver order. */
export type GetAllSymbolsParameters = ReadSolverParameter & {
  /** Per-page HTTP timeout in milliseconds (default 10 seconds). */
  timeoutMs?: number;
};
/** Complete Enigma catalog, including per-side trading state. */
export type GetAllSymbolsReturnType = (Omit<SolverSymbol, "stateLong" | "stateShort"> & {
  /** Unknown when a legacy row omits its per-side state. */
  stateLong?: number;
  stateShort?: number;
  /** Quote currency as advertised by the solver. */
  quoteCurrency: string;
  /** Exact maximum notional, retaining precision beyond the legacy numeric field. */
  maxNotionalValueDecimal: string;
})[];
/** Walk `/symbols` using the response count, including short server pages. */
export async function getAllSymbols(
  config: Config,
  parameters: GetAllSymbolsParameters = {},
): Promise<GetAllSymbolsReturnType> {
  return collectPages(
    async (offset) => {
      const page = record(
        await readEnigma(config, parameters, "/symbols", { limit: 500, offset }, parameters.timeoutMs),
      );
      if (!page || !Array.isArray(page.symbols)) invalid("Invalid symbols page");
      // The existing normalizer validates the generated endpoint's optional fields.
      const rawSymbols = page.symbols;
      if (rawSymbols.some((row) => !record(row))) invalid("Invalid symbol row");
      const normalized = toSolverSymbols(rawSymbols);
      const rows = normalized.map((symbol, index) => {
        const raw = record(rawSymbols[index])!;
        return {
          ...symbol,
          quoteCurrency: String(raw.quote_currency ?? ""),
          stateLong: typeof raw.state_long === "number" ? raw.state_long : undefined,
          stateShort: typeof raw.state_short === "number" ? raw.state_short : undefined,
          maxNotionalValueDecimal: String(raw.max_notional_value ?? symbol.maxNotionalValue),
        };
      });
      if (rows.length !== page.symbols.length) invalid("Invalid symbol row");
      return { rows, count: Number(page.count) };
    },
    (row) => row.symbolId,
  );
}
