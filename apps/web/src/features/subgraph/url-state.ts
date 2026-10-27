import type { DraftValue, FormDraft } from "./form-draft";
import { findRead, readCardId, type ReadSpec } from "./read-catalog";

/** The page route; links built here always point at it. */
export const SUBGRAPH_PATH = "/subgraph";

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** `?read=…&q=…` for a read and its form. `q` is the draft as base64url JSON — plain strings, so no `bigint` handling. */
export function toSearch(read: ReadSpec, draft?: FormDraft): string {
  const params = new URLSearchParams({ read: read.id });
  if (draft) params.set("q", toBase64Url(JSON.stringify(draft)));
  return `?${params.toString()}`;
}

/**
 * The page path to a read's card with its form: `toSearch` plus `#<card id>`, so
 * opening the link lands on that card the way a search hit does.
 */
export function readHref(read: ReadSpec, draft?: FormDraft): string {
  return `${SUBGRAPH_PATH}${toSearch(read, draft)}#${readCardId(read)}`;
}

/** Point the address bar at a read's card and form, without a navigation or a scroll. */
export function replaceReadUrl(read: ReadSpec, draft: FormDraft) {
  window.history.replaceState(null, "", readHref(read, draft));
}

function isDraftValue(value: unknown): value is DraftValue {
  return typeof value === "string" || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

/**
 * Read the page state back out of a URL. Unknown reads and fields, and values of
 * the wrong shape, are dropped rather than trusted, so a hand-edited link cannot
 * put the form into a state it could not reach itself.
 */
export function fromSearch(search: URLSearchParams): { read: ReadSpec; draft?: FormDraft } | undefined {
  const read = findRead(search.get("read"));
  if (!read) return undefined;

  const encoded = search.get("q");
  if (!encoded) return { read };

  try {
    const parsed: unknown = JSON.parse(fromBase64Url(encoded));
    if (typeof parsed !== "object" || parsed === null) return { read };
    const { fields, values } = parsed as { fields?: unknown; values?: unknown };
    if (!Array.isArray(fields) || typeof values !== "object" || values === null) return { read };

    const known = new Set(read.fields.map((field) => field.key));
    const kept = fields.filter((key): key is string => typeof key === "string" && known.has(key));
    const keptValues: Record<string, DraftValue> = {};
    for (const key of kept) {
      const value = (values as Record<string, unknown>)[key];
      if (isDraftValue(value)) keptValues[key] = value;
    }
    return { read, draft: { fields: kept, values: keptValues } };
  } catch {
    return { read };
  }
}
