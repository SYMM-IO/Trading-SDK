import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Deposit / withdraw history over the analytics subgraph's `balanceChanges`
 * collection. Filtered server-side by `account_in`, movement `type_in`
 * (deposit / withdraw / bridge), a `timestamp` range, and
 * `isMarginTransferSideEffect_in` (which internal-transfer legs to keep); sorted
 * by `timestamp`.
 *
 * `account` is a `Bytes` scalar (so `account_in` takes `[Bytes!]`) and `type` is
 * a `String` scalar (`type_in` takes `[String!]`); the codegen `Bytes` scalar is
 * a plain string, so lowercased addresses pass straight through. The
 * `isMarginTransferSideEffect_in` list ( `[false]` / `[true]` / `[true, false]` )
 * makes the include-both case explicit rather than relying on null-omission. The
 * document compiles to a typed query string via graphql-codegen.
 */
export const BalanceChangesDocument = graphql(`
  query BalanceChanges(
    $accounts: [Bytes!]!
    $typeIn: [String!]!
    $isMarginTransferSideEffectIn: [Boolean!]!
    $first: Int!
    $skip: Int!
    $orderDirection: OrderDirection!
    $startDate: BigInt!
    $endDate: BigInt!
  ) {
    balanceChanges(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: $orderDirection
      where: {
        account_in: $accounts
        type_in: $typeIn
        isMarginTransferSideEffect_in: $isMarginTransferSideEffectIn
        timestamp_gte: $startDate
        timestamp_lte: $endDate
      }
    ) {
      id
      type
      amount
      account
      timestamp
      transaction
      isMarginTransferSideEffect
      marginTransferType
    }
  }
`);
