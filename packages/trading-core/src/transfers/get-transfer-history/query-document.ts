/**
 * Events-schema `graphql()` factory. NOTE: events operations must live under
 * `src/transfers/**` — codegen routes the two subgraph schemas by file path, not
 * by which `graphql` is imported. See `packages/trading-core/codegen.ts`.
 */
import { graphql } from "../../symmio-subgraph/types/generated/events";

/**
 * Internal-transfer history over the **events** subgraph's `internalTransfers`
 * collection (raw on-chain transfer events). Filtered server-side by
 * `sender_in` / `user_in` (the `or` group selects outgoing and/or incoming
 * relative to the queried accounts) and a `blockTimestamp` range; sorted by
 * `blockTimestamp`.
 *
 * The events subgraph forbids mixing column filters with `or` at the same level,
 * so the `blockTimestamp` bounds are repeated INSIDE each `or` branch (i.e.
 * `(sender_in AND time) OR (user_in AND time)`) rather than alongside the `or`.
 *
 * `sender` / `user` are `Bytes` scalars (the codegen `Bytes` scalar is a plain
 * string, so lowercased addresses pass straight through). `amount` is 18-decimal
 * (account-balance units), unlike the 6-decimal collateral amounts on
 * `balanceChanges`. Compiles to a typed query string via graphql-codegen against
 * the events schema.
 */
export const InternalTransfersDocument = graphql(`
  query TransferHistory(
    $senders: [Bytes!]!
    $users: [Bytes!]!
    $first: Int!
    $skip: Int!
    $orderDirection: OrderDirection!
    $startDate: BigInt!
    $endDate: BigInt!
  ) {
    internalTransfers(
      first: $first
      skip: $skip
      orderBy: blockTimestamp
      orderDirection: $orderDirection
      where: {
        or: [
          { sender_in: $senders, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate }
          { user_in: $users, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate }
        ]
      }
    ) {
      id
      sender
      user
      amount
      blockTimestamp
      transactionHash
    }
  }
`);
