/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
/** Defines the order direction, either ascending or descending */
export type OrderDirection = "asc" | "desc";

export type TransferHistoryQueryVariables = Exact<{
  senders: Array<string> | string;
  users: Array<string> | string;
  first: number;
  skip: number;
  orderDirection: OrderDirection;
  startDate: string;
  endDate: string;
}>;

export type TransferHistoryQuery = {
  internalTransfers: Array<{
    id: string;
    sender: string;
    user: string;
    amount: string;
    blockTimestamp: string;
    transactionHash: string;
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

export const TransferHistoryDocument = new TypedDocumentString(`
    query TransferHistory($senders: [Bytes!]!, $users: [Bytes!]!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!, $startDate: BigInt!, $endDate: BigInt!) {
  internalTransfers(
    first: $first
    skip: $skip
    orderBy: blockTimestamp
    orderDirection: $orderDirection
    where: {or: [{sender_in: $senders, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate}, {user_in: $users, blockTimestamp_gte: $startDate, blockTimestamp_lte: $endDate}]}
  ) {
    id
    sender
    user
    amount
    blockTimestamp
    transactionHash
  }
}
    `) as unknown as TypedDocumentString<TransferHistoryQuery, TransferHistoryQueryVariables>;
