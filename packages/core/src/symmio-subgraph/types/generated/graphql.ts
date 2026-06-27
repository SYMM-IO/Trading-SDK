/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
/** Defines the order direction, either ascending or descending */
export type OrderDirection = "asc" | "desc";

export type QuoteEventsForQuoteByTypeQueryVariables = Exact<{
  quoteId: string;
  typeIn: Array<string> | string;
  first: number;
  skip: number;
  orderDirection: OrderDirection;
}>;

export type QuoteEventsForQuoteByTypeQuery = {
  quoteEvents: Array<{
    id: string;
    type: string;
    metadata: string | null;
    timestamp: string;
    blockNumber: string;
    transaction: string;
    quoteId: string;
  }>;
};

export type QuotesFundingQueryVariables = Exact<{
  ids: Array<string> | string;
}>;

export type QuotesFundingQuery = {
  quotes: Array<{ quoteId: string; userPaidFunding: string | null; userReceivedFunding: string | null }>;
};

export type QuoteEventsForHistoryQueryVariables = Exact<{
  typeIn: Array<string> | string;
  subAccounts: Array<string> | string;
  first: number;
  skip: number;
  orderDirection: OrderDirection;
  startDate: string;
  endDate: string;
}>;

export type QuoteEventsForHistoryQuery = {
  quoteEvents: Array<{
    id: string;
    type: string;
    metadata: string | null;
    timestamp: string;
    quoteId: string;
    blockNumber: string;
    transaction: string;
    quote: {
      quoteId: string;
      quoteStatus: number | null;
      positionType: number | null;
      orderTypeOpen: number | null;
      symbol: string | null;
      symbolId: string | null;
      partyA: string;
      partyB: string | null;
      quantity: string | null;
      openedPrice: string | null;
      requestedOpenPrice: string | null;
      averageClosedPrice: string | null;
      closePrice: string | null;
      closedAmount: string | null;
      quantityToClose: string | null;
      liquidateAmount: string | null;
      liquidatePrice: string | null;
      subAccount: { id: string } | null;
    };
  }>;
};

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>["__apiType"]>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}

export const QuoteEventsForQuoteByTypeDocument = new TypedDocumentString(`
    query QuoteEventsForQuoteByType($quoteId: BigInt!, $typeIn: [String!]!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!) {
  quoteEvents(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: $orderDirection
    where: {quoteId: $quoteId, type_in: $typeIn}
  ) {
    id
    type
    metadata
    timestamp
    blockNumber
    transaction
    quoteId
  }
}
    `) as unknown as TypedDocumentString<QuoteEventsForQuoteByTypeQuery, QuoteEventsForQuoteByTypeQueryVariables>;
export const QuotesFundingDocument = new TypedDocumentString(`
    query QuotesFunding($ids: [BigInt!]!) {
  quotes(where: {quoteId_in: $ids}) {
    quoteId
    userPaidFunding
    userReceivedFunding
  }
}
    `) as unknown as TypedDocumentString<QuotesFundingQuery, QuotesFundingQueryVariables>;
export const QuoteEventsForHistoryDocument = new TypedDocumentString(`
    query QuoteEventsForHistory($typeIn: [String!]!, $subAccounts: [String!]!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!, $startDate: BigInt!, $endDate: BigInt!) {
  quoteEvents(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: $orderDirection
    where: {type_in: $typeIn, timestamp_gte: $startDate, timestamp_lte: $endDate, quote_: {subAccount_in: $subAccounts}}
  ) {
    id
    type
    metadata
    timestamp
    quoteId
    blockNumber
    transaction
    quote {
      quoteId
      quoteStatus
      positionType
      orderTypeOpen
      symbol
      symbolId
      partyA
      partyB
      subAccount {
        id
      }
      quantity
      openedPrice
      requestedOpenPrice
      averageClosedPrice
      closePrice
      closedAmount
      quantityToClose
      liquidateAmount
      liquidatePrice
    }
  }
}
    `) as unknown as TypedDocumentString<QuoteEventsForHistoryQuery, QuoteEventsForHistoryQueryVariables>;
