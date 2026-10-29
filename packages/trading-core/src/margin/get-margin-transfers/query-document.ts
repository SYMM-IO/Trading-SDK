import { graphql } from "../../symmio-subgraph/types/generated/analytics";

/**
 * Read `MarginTransfer` entities — margin moved between a SubAccount and one of
 * its Virtual Accounts (`ADD`, `REMOVE`, `EMERGENCY_RECOVER`). Every filter
 * (`source`, `type_in`, `transaction_in`, `virtualAccount_in`, `subAccount_in`,
 * the `timestamp` range, the `id_gt` cursor) travels in the action-built
 * `$where`, present only when the caller passes it.
 *
 * The document compiles to a typed query string via graphql-codegen.
 */
export const MarginTransfersDocument = graphql(`
  query MarginTransfers(
    $where: MarginTransfer_filter!
    $first: Int!
    $skip: Int!
    $orderBy: MarginTransfer_orderBy!
    $orderDirection: OrderDirection!
  ) {
    marginTransfers(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection, where: $where) {
      id
      type
      amount
      source
      timestamp
      blockNumber
      transaction
      virtualAccount {
        id
      }
      subAccount {
        id
      }
    }
  }
`);
