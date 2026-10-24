import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Batch read of `userPaidFunding` / `userReceivedFunding` for the given on-chain
 * quote ids. Filters on the protocol-level `quoteId` scalar — not the subgraph's
 * opaque composite `id` — so callers never need the diamond address to query
 * funding. The action builds `$where` (`quoteId_in`, plus `source` only when the
 * caller passes a diamond), so an omitted filter is absent rather than null.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const QuotesFundingDocument = graphql(`
  query QuotesFunding($where: Quote_filter!, $first: Int!) {
    quotes(first: $first, where: $where) {
      quoteId
      userPaidFunding
      userReceivedFunding
    }
  }
`);
