/* eslint-disable */
import * as types from "./graphql";

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  "\n  query TransferHistory(\n    $senders: [Bytes!]!\n    $users: [Bytes!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    internalTransfers(\n      first: $first\n      skip: $skip\n      orderBy: blockTimestamp\n      orderDirection: $orderDirection\n      where: {\n        or: [\n          { sender_in: $senders, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate }\n          { user_in: $users, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate }\n        ]\n      }\n    ) {\n      id\n      sender\n      user\n      amount\n      blockTimestamp\n      transactionHash\n    }\n  }\n": typeof types.TransferHistoryDocument;
};
const documents: Documents = {
  "\n  query TransferHistory(\n    $senders: [Bytes!]!\n    $users: [Bytes!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    internalTransfers(\n      first: $first\n      skip: $skip\n      orderBy: blockTimestamp\n      orderDirection: $orderDirection\n      where: {\n        or: [\n          { sender_in: $senders, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate }\n          { user_in: $users, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate }\n        ]\n      }\n    ) {\n      id\n      sender\n      user\n      amount\n      blockTimestamp\n      transactionHash\n    }\n  }\n":
    types.TransferHistoryDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query TransferHistory(\n    $senders: [Bytes!]!\n    $users: [Bytes!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    internalTransfers(\n      first: $first\n      skip: $skip\n      orderBy: blockTimestamp\n      orderDirection: $orderDirection\n      where: {\n        or: [\n          { sender_in: $senders, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate }\n          { user_in: $users, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate }\n        ]\n      }\n    ) {\n      id\n      sender\n      user\n      amount\n      blockTimestamp\n      transactionHash\n    }\n  }\n",
): typeof import("./graphql").TransferHistoryDocument;

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
