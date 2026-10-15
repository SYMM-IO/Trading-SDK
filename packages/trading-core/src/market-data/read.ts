import axios, { isAxiosError } from "axios";
import type { Config } from "../core/config";
import { SymmApiError, SymmError } from "../shared/errors/symm-error";
import type { ReadSolverParameter } from "../shared/types/properties";
import { assertSolverKind } from "../solvers/assert-solver-kind";

export function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
export function symbolId(value: unknown): number | undefined {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
export function finite(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
export async function readEnigma(
  config: Config,
  parameters: ReadSolverParameter,
  path: string,
  params?: Record<string, unknown>,
  timeout = 10_000,
): Promise<unknown> {
  const solver = config.getSolver(parameters);
  assertSolverKind(solver, "enigma", path);
  try {
    return (await axios.get<unknown>(path, { baseURL: solver.url, params, timeout })).data;
  } catch (error) {
    if (isAxiosError(error))
      throw SymmApiError.fromAxios(error, { code: "FETCH_MARKET_DATA_FAILED", baseURL: solver.url });
    throw error;
  }
}
export function invalid(message: string): never {
  throw new SymmError("api", "INVALID_MARKET_DATA", message);
}
/** Add plain decimal dollar strings without passing through binary floats. */
export function sumDecimals(values: readonly string[]): string {
  const scale = Math.max(0, ...values.map((value) => (value.split(".")[1] ?? "").length));
  let sum = 0n;
  for (const value of values) {
    if (!/^-?\d+(?:\.\d+)?$/.test(value)) invalid("Invalid decimal market aggregate");
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    const amount = BigInt(whole! + fraction.padEnd(scale, "0"));
    sum += negative ? -amount : amount;
  }
  const negative = sum < 0n;
  const digits = (negative ? -sum : sum).toString().padStart(scale + 1, "0");
  const result = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "") : digits;
  return `${negative ? "-" : ""}${result}`;
}

/** Walk count-bearing Enigma pages; a repeated or truncated page is not a complete snapshot. */
export async function collectPages<T>(
  read: (offset: number) => Promise<{ rows: T[]; count: number }>,
  identify: (row: T) => number | undefined,
): Promise<T[]> {
  const rows: T[] = [];
  const ids = new Set<number>();
  for (let page = 0; page < 100; page++) {
    const next = await read(rows.length);
    if (!Number.isSafeInteger(next.count) || next.count < 0) invalid("Invalid market count");
    if (next.rows.length === 0 && rows.length < next.count) invalid("Market pagination made no progress");
    for (const row of next.rows) {
      const id = identify(row);
      if (id !== undefined) {
        if (ids.has(id)) invalid("Market pagination made no progress (duplicate ID)");
        ids.add(id);
      }
      rows.push(row);
    }
    if (rows.length >= next.count) return rows;
  }
  return invalid("Market pagination exceeded its safety limit");
}
