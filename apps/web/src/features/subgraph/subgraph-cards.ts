import type { SearchCardMeta } from "../search/search-card-meta";
import { READ_CATALOG, readCardId } from "./read-catalog";

/**
 * Every card on the Subgraph page, in display order — the command-palette search
 * metadata for {@link SubgraphPage}. One card per read, so it follows the catalog:
 * a read added there is searchable without an entry here.
 */
export const SUBGRAPH_CARDS: readonly SearchCardMeta[] = READ_CATALOG.map((read) => ({
  id: readCardId(read),
  title: read.id,
  kind: "read",
  section: read.group,
  summary: read.summary,
  keywords: ["subgraph", "GraphQL", read.subgraph, read.hook, ...read.fields.map((field) => field.key)],
}));
