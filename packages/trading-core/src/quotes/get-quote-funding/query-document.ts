import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Batch read of `userPaidFunding` / `userReceivedFunding` for the given on-chain
 * quote ids. Filters on the protocol-level `quoteId` scalar — not the subgraph's
 * opaque composite `id` — so callers never need the diamond address to query
 * funding.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const QuotesFundingDocument = graphql(`
  query QuotesFunding($ids: [BigInt!]!, $first: Int!) {
    quotes(first: $first, where: { quoteId_in: $ids }) {
      quoteId
      userPaidFunding
      userReceivedFunding
    }
  }
`);
