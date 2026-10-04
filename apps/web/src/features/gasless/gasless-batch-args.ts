import { zeroAddress, type AbiFunction, type AbiParameter, type Address } from "viem";

/** A decimal integer followed by `n` — how the args editor spells a `bigint` inside JSON. */
const BIGINT_LITERAL = /^-?\d+n$/;

/** What the args editor's text parses to. */
export type ParsedBatchArgs = { args: unknown[] } | { error: string };

/**
 * Parse a batch call's arguments from the editor's JSON, reading a `"123n"`
 * string as a `bigint`. Plain JSON numbers lose precision past 2^53, which
 * every 18-decimal amount exceeds, so integers travel as these strings.
 *
 * @param text - A JSON array; blank means no arguments.
 * @returns The arguments, or the message to show under the editor.
 */
export function parseBatchArgs(text: string): ParsedBatchArgs {
  if (text.trim().length === 0) return { args: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text, (_key, value: unknown) =>
      typeof value === "string" && BIGINT_LITERAL.test(value) ? BigInt(value.slice(0, -1)) : value,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "invalid JSON" };
  }
  return Array.isArray(parsed) ? { args: parsed } : { error: "the arguments must be a JSON array" };
}

/**
 * A starting argument list for `item` in the editor's JSON form — one
 * placeholder per input, the account in every address slot, `"0n"` for every
 * integer — so picking a write never starts from a blank box.
 *
 * @param item - The relayable write's ABI item.
 * @param account - The batch's account, when one is picked.
 * @returns Pretty-printed JSON.
 */
export function batchArgsSkeleton(item: AbiFunction, account?: Address): string {
  return JSON.stringify(
    item.inputs.map((input) => placeholderFor(input, account ?? zeroAddress)),
    null,
    2,
  );
}

function placeholderFor(input: AbiParameter, account: Address): unknown {
  if (input.type.endsWith("]")) return [];
  if (input.type === "tuple" && "components" in input) {
    return Object.fromEntries(
      input.components.map((component, index) => [component.name ?? `${index}`, placeholderFor(component, account)]),
    );
  }
  if (input.type === "address") return account;
  if (input.type === "bool") return false;
  if (input.type === "string") return "";
  if (input.type === "bytes") return "0x";
  if (input.type.startsWith("bytes")) return `0x${"00".repeat(Number(input.type.slice("bytes".length)))}`;
  if (input.type.startsWith("uint") || input.type.startsWith("int")) return "0n";
  return null;
}
