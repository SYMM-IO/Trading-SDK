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
  "\n  query BalanceChanges(\n    $accounts: [Bytes!]!\n    $typeIn: [String!]!\n    $isMarginTransferSideEffectIn: [Boolean!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    balanceChanges(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: {\n        account_in: $accounts\n        type_in: $typeIn\n        isMarginTransferSideEffect_in: $isMarginTransferSideEffectIn\n        timestamp_gte: $startDate\n        timestamp_lte: $endDate\n      }\n    ) {\n      id\n      type\n      amount\n      account\n      timestamp\n      transaction\n      isMarginTransferSideEffect\n      marginTransferType\n    }\n  }\n": typeof types.BalanceChangesDocument;
  "\n  query QuoteEventsForQuoteByType(\n    $quoteId: BigInt!\n    $typeIn: [String!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n  ) {\n    quoteEvents(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: { quoteId: $quoteId, type_in: $typeIn }\n    ) {\n      id\n      type\n      metadata\n      timestamp\n      blockNumber\n      transaction\n      quoteId\n    }\n  }\n": typeof types.QuoteEventsForQuoteByTypeDocument;
  "\n  query QuotesFunding($ids: [BigInt!]!) {\n    quotes(where: { quoteId_in: $ids }) {\n      quoteId\n      userPaidFunding\n      userReceivedFunding\n    }\n  }\n": typeof types.QuotesFundingDocument;
  "\n  query QuoteEventsForHistory(\n    $typeIn: [String!]!\n    $subAccounts: [String!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    quoteEvents(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: {\n        type_in: $typeIn\n        timestamp_gte: $startDate\n        timestamp_lte: $endDate\n        quote_: { subAccount_in: $subAccounts }\n      }\n    ) {\n      id\n      type\n      metadata\n      timestamp\n      quoteId\n      blockNumber\n      transaction\n      quote {\n        quoteId\n        quoteStatus\n        positionType\n        orderTypeOpen\n        symbol\n        symbolId\n        partyA\n        partyB\n        subAccount {\n          id\n        }\n        quantity\n        openedPrice\n        requestedOpenPrice\n        averageClosedPrice\n        closePrice\n        closedAmount\n        quantityToClose\n        liquidateAmount\n        liquidatePrice\n      }\n    }\n  }\n": typeof types.QuoteEventsForHistoryDocument;
};
const documents: Documents = {
  "\n  query BalanceChanges(\n    $accounts: [Bytes!]!\n    $typeIn: [String!]!\n    $isMarginTransferSideEffectIn: [Boolean!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    balanceChanges(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: {\n        account_in: $accounts\n        type_in: $typeIn\n        isMarginTransferSideEffect_in: $isMarginTransferSideEffectIn\n        timestamp_gte: $startDate\n        timestamp_lte: $endDate\n      }\n    ) {\n      id\n      type\n      amount\n      account\n      timestamp\n      transaction\n      isMarginTransferSideEffect\n      marginTransferType\n    }\n  }\n":
    types.BalanceChangesDocument,
  "\n  query QuoteEventsForQuoteByType(\n    $quoteId: BigInt!\n    $typeIn: [String!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n  ) {\n    quoteEvents(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: { quoteId: $quoteId, type_in: $typeIn }\n    ) {\n      id\n      type\n      metadata\n      timestamp\n      blockNumber\n      transaction\n      quoteId\n    }\n  }\n":
    types.QuoteEventsForQuoteByTypeDocument,
  "\n  query QuotesFunding($ids: [BigInt!]!) {\n    quotes(where: { quoteId_in: $ids }) {\n      quoteId\n      userPaidFunding\n      userReceivedFunding\n    }\n  }\n":
    types.QuotesFundingDocument,
  "\n  query QuoteEventsForHistory(\n    $typeIn: [String!]!\n    $subAccounts: [String!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    quoteEvents(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: {\n        type_in: $typeIn\n        timestamp_gte: $startDate\n        timestamp_lte: $endDate\n        quote_: { subAccount_in: $subAccounts }\n      }\n    ) {\n      id\n      type\n      metadata\n      timestamp\n      quoteId\n      blockNumber\n      transaction\n      quote {\n        quoteId\n        quoteStatus\n        positionType\n        orderTypeOpen\n        symbol\n        symbolId\n        partyA\n        partyB\n        subAccount {\n          id\n        }\n        quantity\n        openedPrice\n        requestedOpenPrice\n        averageClosedPrice\n        closePrice\n        closedAmount\n        quantityToClose\n        liquidateAmount\n        liquidatePrice\n      }\n    }\n  }\n":
    types.QuoteEventsForHistoryDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query BalanceChanges(\n    $accounts: [Bytes!]!\n    $typeIn: [String!]!\n    $isMarginTransferSideEffectIn: [Boolean!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    balanceChanges(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: {\n        account_in: $accounts\n        type_in: $typeIn\n        isMarginTransferSideEffect_in: $isMarginTransferSideEffectIn\n        timestamp_gte: $startDate\n        timestamp_lte: $endDate\n      }\n    ) {\n      id\n      type\n      amount\n      account\n      timestamp\n      transaction\n      isMarginTransferSideEffect\n      marginTransferType\n    }\n  }\n",
): typeof import("./graphql").BalanceChangesDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query QuoteEventsForQuoteByType(\n    $quoteId: BigInt!\n    $typeIn: [String!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n  ) {\n    quoteEvents(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: { quoteId: $quoteId, type_in: $typeIn }\n    ) {\n      id\n      type\n      metadata\n      timestamp\n      blockNumber\n      transaction\n      quoteId\n    }\n  }\n",
): typeof import("./graphql").QuoteEventsForQuoteByTypeDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query QuotesFunding($ids: [BigInt!]!) {\n    quotes(where: { quoteId_in: $ids }) {\n      quoteId\n      userPaidFunding\n      userReceivedFunding\n    }\n  }\n",
): typeof import("./graphql").QuotesFundingDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "\n  query QuoteEventsForHistory(\n    $typeIn: [String!]!\n    $subAccounts: [String!]!\n    $first: Int!\n    $skip: Int!\n    $orderDirection: OrderDirection!\n    $startDate: BigInt!\n    $endDate: BigInt!\n  ) {\n    quoteEvents(\n      first: $first\n      skip: $skip\n      orderBy: timestamp\n      orderDirection: $orderDirection\n      where: {\n        type_in: $typeIn\n        timestamp_gte: $startDate\n        timestamp_lte: $endDate\n        quote_: { subAccount_in: $subAccounts }\n      }\n    ) {\n      id\n      type\n      metadata\n      timestamp\n      quoteId\n      blockNumber\n      transaction\n      quote {\n        quoteId\n        quoteStatus\n        positionType\n        orderTypeOpen\n        symbol\n        symbolId\n        partyA\n        partyB\n        subAccount {\n          id\n        }\n        quantity\n        openedPrice\n        requestedOpenPrice\n        averageClosedPrice\n        closePrice\n        closedAmount\n        quantityToClose\n        liquidateAmount\n        liquidatePrice\n      }\n    }\n  }\n",
): typeof import("./graphql").QuoteEventsForHistoryDocument;

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
