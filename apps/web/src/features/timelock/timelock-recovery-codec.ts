import { isAddress, type Address, type Hex } from "viem";

/** Browser-only journal format for this console, never an SDK persistence policy. */
export interface ScheduledRecovery {
  kind: "scheduled-operation";
  confirmed: boolean;
  callData: Hex;
  innerCallData: Hex;
  originalAccount?: Address;
}

/** Parse a saved delayed-operation record without reading or changing browser storage. */
export function readScheduledRecovery(value: string | null): ScheduledRecovery | undefined {
  if (!value) return undefined;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== "object" || !("kind" in data) || data.kind !== "scheduled-operation") return undefined;
    if (
      !("confirmed" in data) ||
      typeof data.confirmed !== "boolean" ||
      !("callData" in data) ||
      !("innerCallData" in data)
    )
      return undefined;
    if (
      typeof data.callData !== "string" ||
      typeof data.innerCallData !== "string" ||
      !/^0x(?:[\da-fA-F]{2}){4,}$/.test(data.callData) ||
      !/^0x(?:[\da-fA-F]{2}){4,}$/.test(data.innerCallData)
    )
      return undefined;
    if ("originalAccount" in data && (typeof data.originalAccount !== "string" || !isAddress(data.originalAccount)))
      return undefined;
    return {
      kind: data.kind,
      confirmed: data.confirmed,
      callData: data.callData as Hex,
      innerCallData: data.innerCallData as Hex,
      ...("originalAccount" in data ? { originalAccount: data.originalAccount as Address } : {}),
    };
  } catch {
    return undefined;
  }
}
