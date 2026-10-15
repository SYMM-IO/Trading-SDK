import type { SearchCardMeta } from "../search/search-card-meta";

/**
 * Every card on the Session Keys page, in display order — the command-palette
 * search metadata for {@link SessionKeysPanel}. A card added there must be listed
 * here to be searchable; the coverage spec fails until it is.
 */
export const SESSION_KEY_CARDS: readonly SearchCardMeta[] = [
  {
    id: "card-local-session-key",
    title: "Local session key",
    kind: "write",
    summary: "Generate or load a browser-local session key, encrypted in local storage.",
    keywords: ["useSessionKey", "session key", "signer", "private key", "import key"],
  },
  {
    id: "card-session-key-delegation",
    title: "Gasless session-key authority",
    kind: "write",
    summary: "Delegate trading and account authority to the session key, with no gas to pay.",
    keywords: ["useSessionKeyDelegation", "grantDelegation", "delegation", "gasless", "authority"],
  },
];
