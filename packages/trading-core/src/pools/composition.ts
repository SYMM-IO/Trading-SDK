import { formatUnits } from "viem";

/** A source that could not supply a complete snapshot. Never contains credentials or response bodies. */
export interface PoolReadGap {
  /** Read family, such as deposits, profit, detail, or listed. */
  source: string;
  /** Exact pool address, when the gap belongs to one pool. */
  tokenContractAddress?: string;
  /** Failed requests are distinct from bounded or repeated pagination. */
  reason: "failed" | "truncated" | "repeated-page" | "ambiguous-address";
}

export function units(value: bigint | null | undefined): number | null {
  return value == null ? null : Number(formatUnits(value, 18));
}

export async function readOptional<T>(
  read: () => Promise<T>,
  gaps: PoolReadGap[],
  source: string,
  tokenContractAddress?: string,
): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    // Expired sessions must remain actionable errors, not partial portfolios.
    if (error && typeof error === "object" && "status" in error && (error.status === 401 || error.status === 403))
      throw error;
    gaps.push({ source, tokenContractAddress, reason: "failed" });
    return null;
  }
}

export async function readPages<T>(
  read: (offset: number) => Promise<{ items: T[]; total: number }>,
  identity: (item: T) => string,
  gaps: PoolReadGap[],
  source: string,
  maxPages = 10,
): Promise<T[]> {
  const values = new Map<string, T>();
  let offset = 0;
  for (let page = 0; page < maxPages; page++) {
    const result = await readOptional(() => read(offset), gaps, source);
    // A later page failing must not erase holdings discovered on earlier pages.
    // The gap still prevents callers from treating partial history as complete.
    if (result == null) return [...values.values()];
    const previousSize = values.size;
    for (const item of result.items) values.set(identity(item), item);
    offset += result.items.length;
    if (values.size >= result.total) return [...values.values()];
    if (values.size === previousSize) {
      gaps.push({ source, reason: "repeated-page" });
      return [...values.values()];
    }
  }
  gaps.push({ source, reason: "truncated" });
  return [...values.values()];
}
