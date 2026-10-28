/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { DocumentTypeDecoration } from "@graphql-typed-document-node/core";
export type Account_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  account?: string | null | undefined;
  accountKind?: string | null | undefined;
  accountKind_contains?: string | null | undefined;
  accountKind_contains_nocase?: string | null | undefined;
  accountKind_ends_with?: string | null | undefined;
  accountKind_ends_with_nocase?: string | null | undefined;
  accountKind_gt?: string | null | undefined;
  accountKind_gte?: string | null | undefined;
  accountKind_in?: Array<string> | null | undefined;
  accountKind_lt?: string | null | undefined;
  accountKind_lte?: string | null | undefined;
  accountKind_not?: string | null | undefined;
  accountKind_not_contains?: string | null | undefined;
  accountKind_not_contains_nocase?: string | null | undefined;
  accountKind_not_ends_with?: string | null | undefined;
  accountKind_not_ends_with_nocase?: string | null | undefined;
  accountKind_not_in?: Array<string> | null | undefined;
  accountKind_not_starts_with?: string | null | undefined;
  accountKind_not_starts_with_nocase?: string | null | undefined;
  accountKind_starts_with?: string | null | undefined;
  accountKind_starts_with_nocase?: string | null | undefined;
  accountLayerSource?: string | null | undefined;
  accountLayerSource_contains?: string | null | undefined;
  accountLayerSource_gt?: string | null | undefined;
  accountLayerSource_gte?: string | null | undefined;
  accountLayerSource_in?: Array<string> | null | undefined;
  accountLayerSource_lt?: string | null | undefined;
  accountLayerSource_lte?: string | null | undefined;
  accountLayerSource_not?: string | null | undefined;
  accountLayerSource_not_contains?: string | null | undefined;
  accountLayerSource_not_in?: Array<string> | null | undefined;
  accountSource?: string | null | undefined;
  accountSource_contains?: string | null | undefined;
  accountSource_gt?: string | null | undefined;
  accountSource_gte?: string | null | undefined;
  accountSource_in?: Array<string> | null | undefined;
  accountSource_lt?: string | null | undefined;
  accountSource_lte?: string | null | undefined;
  accountSource_not?: string | null | undefined;
  accountSource_not_contains?: string | null | undefined;
  accountSource_not_in?: Array<string> | null | undefined;
  account_contains?: string | null | undefined;
  account_gt?: string | null | undefined;
  account_gte?: string | null | undefined;
  account_in?: Array<string> | null | undefined;
  account_lt?: string | null | undefined;
  account_lte?: string | null | undefined;
  account_not?: string | null | undefined;
  account_not_contains?: string | null | undefined;
  account_not_in?: Array<string> | null | undefined;
  affiliate?: string | null | undefined;
  affiliateRef?: string | null | undefined;
  affiliateRef_?: Affiliate_Filter | null | undefined;
  affiliateRef_contains?: string | null | undefined;
  affiliateRef_contains_nocase?: string | null | undefined;
  affiliateRef_ends_with?: string | null | undefined;
  affiliateRef_ends_with_nocase?: string | null | undefined;
  affiliateRef_gt?: string | null | undefined;
  affiliateRef_gte?: string | null | undefined;
  affiliateRef_in?: Array<string> | null | undefined;
  affiliateRef_lt?: string | null | undefined;
  affiliateRef_lte?: string | null | undefined;
  affiliateRef_not?: string | null | undefined;
  affiliateRef_not_contains?: string | null | undefined;
  affiliateRef_not_contains_nocase?: string | null | undefined;
  affiliateRef_not_ends_with?: string | null | undefined;
  affiliateRef_not_ends_with_nocase?: string | null | undefined;
  affiliateRef_not_in?: Array<string> | null | undefined;
  affiliateRef_not_starts_with?: string | null | undefined;
  affiliateRef_not_starts_with_nocase?: string | null | undefined;
  affiliateRef_starts_with?: string | null | undefined;
  affiliateRef_starts_with_nocase?: string | null | undefined;
  affiliate_contains?: string | null | undefined;
  affiliate_gt?: string | null | undefined;
  affiliate_gte?: string | null | undefined;
  affiliate_in?: Array<string> | null | undefined;
  affiliate_lt?: string | null | undefined;
  affiliate_lte?: string | null | undefined;
  affiliate_not?: string | null | undefined;
  affiliate_not_contains?: string | null | undefined;
  affiliate_not_in?: Array<string> | null | undefined;
  allocated?: string | null | undefined;
  allocated_gt?: string | null | undefined;
  allocated_gte?: string | null | undefined;
  allocated_in?: Array<string> | null | undefined;
  allocated_lt?: string | null | undefined;
  allocated_lte?: string | null | undefined;
  allocated_not?: string | null | undefined;
  allocated_not_in?: Array<string> | null | undefined;
  and?: Array<Account_Filter | null | undefined> | null | undefined;
  blockNumber?: string | null | undefined;
  blockNumber_gt?: string | null | undefined;
  blockNumber_gte?: string | null | undefined;
  blockNumber_in?: Array<string> | null | undefined;
  blockNumber_lt?: string | null | undefined;
  blockNumber_lte?: string | null | undefined;
  blockNumber_not?: string | null | undefined;
  blockNumber_not_in?: Array<string> | null | undefined;
  coreSource?: string | null | undefined;
  coreSource_contains?: string | null | undefined;
  coreSource_gt?: string | null | undefined;
  coreSource_gte?: string | null | undefined;
  coreSource_in?: Array<string> | null | undefined;
  coreSource_lt?: string | null | undefined;
  coreSource_lte?: string | null | undefined;
  coreSource_not?: string | null | undefined;
  coreSource_not_contains?: string | null | undefined;
  coreSource_not_in?: Array<string> | null | undefined;
  deallocated?: string | null | undefined;
  deallocated_gt?: string | null | undefined;
  deallocated_gte?: string | null | undefined;
  deallocated_in?: Array<string> | null | undefined;
  deallocated_lt?: string | null | undefined;
  deallocated_lte?: string | null | undefined;
  deallocated_not?: string | null | undefined;
  deallocated_not_in?: Array<string> | null | undefined;
  deploymentId?: string | null | undefined;
  deploymentId_contains?: string | null | undefined;
  deploymentId_contains_nocase?: string | null | undefined;
  deploymentId_ends_with?: string | null | undefined;
  deploymentId_ends_with_nocase?: string | null | undefined;
  deploymentId_gt?: string | null | undefined;
  deploymentId_gte?: string | null | undefined;
  deploymentId_in?: Array<string> | null | undefined;
  deploymentId_lt?: string | null | undefined;
  deploymentId_lte?: string | null | undefined;
  deploymentId_not?: string | null | undefined;
  deploymentId_not_contains?: string | null | undefined;
  deploymentId_not_contains_nocase?: string | null | undefined;
  deploymentId_not_ends_with?: string | null | undefined;
  deploymentId_not_ends_with_nocase?: string | null | undefined;
  deploymentId_not_in?: Array<string> | null | undefined;
  deploymentId_not_starts_with?: string | null | undefined;
  deploymentId_not_starts_with_nocase?: string | null | undefined;
  deploymentId_starts_with?: string | null | undefined;
  deploymentId_starts_with_nocase?: string | null | undefined;
  deposit?: string | null | undefined;
  deposit_gt?: string | null | undefined;
  deposit_gte?: string | null | undefined;
  deposit_in?: Array<string> | null | undefined;
  deposit_lt?: string | null | undefined;
  deposit_lte?: string | null | undefined;
  deposit_not?: string | null | undefined;
  deposit_not_in?: Array<string> | null | undefined;
  globalCounter?: string | null | undefined;
  globalCounter_gt?: string | null | undefined;
  globalCounter_gte?: string | null | undefined;
  globalCounter_in?: Array<string> | null | undefined;
  globalCounter_lt?: string | null | undefined;
  globalCounter_lte?: string | null | undefined;
  globalCounter_not?: string | null | undefined;
  globalCounter_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  isDeleted?: boolean | null | undefined;
  isDeleted_in?: Array<boolean> | null | undefined;
  isDeleted_not?: boolean | null | undefined;
  isDeleted_not_in?: Array<boolean> | null | undefined;
  isVirtual?: boolean | null | undefined;
  isVirtual_in?: Array<boolean> | null | undefined;
  isVirtual_not?: boolean | null | undefined;
  isVirtual_not_in?: Array<boolean> | null | undefined;
  lastActivityTimestamp?: string | null | undefined;
  lastActivityTimestamp_gt?: string | null | undefined;
  lastActivityTimestamp_gte?: string | null | undefined;
  lastActivityTimestamp_in?: Array<string> | null | undefined;
  lastActivityTimestamp_lt?: string | null | undefined;
  lastActivityTimestamp_lte?: string | null | undefined;
  lastActivityTimestamp_not?: string | null | undefined;
  lastActivityTimestamp_not_in?: Array<string> | null | undefined;
  lastBalanceActivityTimestamp?: string | null | undefined;
  lastBalanceActivityTimestamp_gt?: string | null | undefined;
  lastBalanceActivityTimestamp_gte?: string | null | undefined;
  lastBalanceActivityTimestamp_in?: Array<string> | null | undefined;
  lastBalanceActivityTimestamp_lt?: string | null | undefined;
  lastBalanceActivityTimestamp_lte?: string | null | undefined;
  lastBalanceActivityTimestamp_not?: string | null | undefined;
  lastBalanceActivityTimestamp_not_in?: Array<string> | null | undefined;
  lastCoreActivityTimestamp?: string | null | undefined;
  lastCoreActivityTimestamp_gt?: string | null | undefined;
  lastCoreActivityTimestamp_gte?: string | null | undefined;
  lastCoreActivityTimestamp_in?: Array<string> | null | undefined;
  lastCoreActivityTimestamp_lt?: string | null | undefined;
  lastCoreActivityTimestamp_lte?: string | null | undefined;
  lastCoreActivityTimestamp_not?: string | null | undefined;
  lastCoreActivityTimestamp_not_in?: Array<string> | null | undefined;
  lastLayerActivityTimestamp?: string | null | undefined;
  lastLayerActivityTimestamp_gt?: string | null | undefined;
  lastLayerActivityTimestamp_gte?: string | null | undefined;
  lastLayerActivityTimestamp_in?: Array<string> | null | undefined;
  lastLayerActivityTimestamp_lt?: string | null | undefined;
  lastLayerActivityTimestamp_lte?: string | null | undefined;
  lastLayerActivityTimestamp_not?: string | null | undefined;
  lastLayerActivityTimestamp_not_in?: Array<string> | null | undefined;
  name?: string | null | undefined;
  name_contains?: string | null | undefined;
  name_contains_nocase?: string | null | undefined;
  name_ends_with?: string | null | undefined;
  name_ends_with_nocase?: string | null | undefined;
  name_gt?: string | null | undefined;
  name_gte?: string | null | undefined;
  name_in?: Array<string> | null | undefined;
  name_lt?: string | null | undefined;
  name_lte?: string | null | undefined;
  name_not?: string | null | undefined;
  name_not_contains?: string | null | undefined;
  name_not_contains_nocase?: string | null | undefined;
  name_not_ends_with?: string | null | undefined;
  name_not_ends_with_nocase?: string | null | undefined;
  name_not_in?: Array<string> | null | undefined;
  name_not_starts_with?: string | null | undefined;
  name_not_starts_with_nocase?: string | null | undefined;
  name_starts_with?: string | null | undefined;
  name_starts_with_nocase?: string | null | undefined;
  or?: Array<Account_Filter | null | undefined> | null | undefined;
  owner?: string | null | undefined;
  owner_contains?: string | null | undefined;
  owner_gt?: string | null | undefined;
  owner_gte?: string | null | undefined;
  owner_in?: Array<string> | null | undefined;
  owner_lt?: string | null | undefined;
  owner_lte?: string | null | undefined;
  owner_not?: string | null | undefined;
  owner_not_contains?: string | null | undefined;
  owner_not_in?: Array<string> | null | undefined;
  parentAddress?: string | null | undefined;
  parentAddress_contains?: string | null | undefined;
  parentAddress_gt?: string | null | undefined;
  parentAddress_gte?: string | null | undefined;
  parentAddress_in?: Array<string> | null | undefined;
  parentAddress_lt?: string | null | undefined;
  parentAddress_lte?: string | null | undefined;
  parentAddress_not?: string | null | undefined;
  parentAddress_not_contains?: string | null | undefined;
  parentAddress_not_in?: Array<string> | null | undefined;
  positionsCount?: string | null | undefined;
  positionsCount_gt?: string | null | undefined;
  positionsCount_gte?: string | null | undefined;
  positionsCount_in?: Array<string> | null | undefined;
  positionsCount_lt?: string | null | undefined;
  positionsCount_lte?: string | null | undefined;
  positionsCount_not?: string | null | undefined;
  positionsCount_not_in?: Array<string> | null | undefined;
  quotesCount?: string | null | undefined;
  quotesCount_gt?: string | null | undefined;
  quotesCount_gte?: string | null | undefined;
  quotesCount_in?: Array<string> | null | undefined;
  quotesCount_lt?: string | null | undefined;
  quotesCount_lte?: string | null | undefined;
  quotesCount_not?: string | null | undefined;
  quotesCount_not_in?: Array<string> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  subAccount?: string | null | undefined;
  subAccount_?: SubAccount_Filter | null | undefined;
  subAccount_contains?: string | null | undefined;
  subAccount_contains_nocase?: string | null | undefined;
  subAccount_ends_with?: string | null | undefined;
  subAccount_ends_with_nocase?: string | null | undefined;
  subAccount_gt?: string | null | undefined;
  subAccount_gte?: string | null | undefined;
  subAccount_in?: Array<string> | null | undefined;
  subAccount_lt?: string | null | undefined;
  subAccount_lte?: string | null | undefined;
  subAccount_not?: string | null | undefined;
  subAccount_not_contains?: string | null | undefined;
  subAccount_not_contains_nocase?: string | null | undefined;
  subAccount_not_ends_with?: string | null | undefined;
  subAccount_not_ends_with_nocase?: string | null | undefined;
  subAccount_not_in?: Array<string> | null | undefined;
  subAccount_not_starts_with?: string | null | undefined;
  subAccount_not_starts_with_nocase?: string | null | undefined;
  subAccount_starts_with?: string | null | undefined;
  subAccount_starts_with_nocase?: string | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  transaction?: string | null | undefined;
  transaction_contains?: string | null | undefined;
  transaction_gt?: string | null | undefined;
  transaction_gte?: string | null | undefined;
  transaction_in?: Array<string> | null | undefined;
  transaction_lt?: string | null | undefined;
  transaction_lte?: string | null | undefined;
  transaction_not?: string | null | undefined;
  transaction_not_contains?: string | null | undefined;
  transaction_not_in?: Array<string> | null | undefined;
  type?: string | null | undefined;
  type_contains?: string | null | undefined;
  type_contains_nocase?: string | null | undefined;
  type_ends_with?: string | null | undefined;
  type_ends_with_nocase?: string | null | undefined;
  type_gt?: string | null | undefined;
  type_gte?: string | null | undefined;
  type_in?: Array<string> | null | undefined;
  type_lt?: string | null | undefined;
  type_lte?: string | null | undefined;
  type_not?: string | null | undefined;
  type_not_contains?: string | null | undefined;
  type_not_contains_nocase?: string | null | undefined;
  type_not_ends_with?: string | null | undefined;
  type_not_ends_with_nocase?: string | null | undefined;
  type_not_in?: Array<string> | null | undefined;
  type_not_starts_with?: string | null | undefined;
  type_not_starts_with_nocase?: string | null | undefined;
  type_starts_with?: string | null | undefined;
  type_starts_with_nocase?: string | null | undefined;
  updateTimestamp?: string | null | undefined;
  updateTimestamp_gt?: string | null | undefined;
  updateTimestamp_gte?: string | null | undefined;
  updateTimestamp_in?: Array<string> | null | undefined;
  updateTimestamp_lt?: string | null | undefined;
  updateTimestamp_lte?: string | null | undefined;
  updateTimestamp_not?: string | null | undefined;
  updateTimestamp_not_in?: Array<string> | null | undefined;
  user?: string | null | undefined;
  userRef?: string | null | undefined;
  userRef_?: User_Filter | null | undefined;
  userRef_contains?: string | null | undefined;
  userRef_contains_nocase?: string | null | undefined;
  userRef_ends_with?: string | null | undefined;
  userRef_ends_with_nocase?: string | null | undefined;
  userRef_gt?: string | null | undefined;
  userRef_gte?: string | null | undefined;
  userRef_in?: Array<string> | null | undefined;
  userRef_lt?: string | null | undefined;
  userRef_lte?: string | null | undefined;
  userRef_not?: string | null | undefined;
  userRef_not_contains?: string | null | undefined;
  userRef_not_contains_nocase?: string | null | undefined;
  userRef_not_ends_with?: string | null | undefined;
  userRef_not_ends_with_nocase?: string | null | undefined;
  userRef_not_in?: Array<string> | null | undefined;
  userRef_not_starts_with?: string | null | undefined;
  userRef_not_starts_with_nocase?: string | null | undefined;
  userRef_starts_with?: string | null | undefined;
  userRef_starts_with_nocase?: string | null | undefined;
  user_contains?: string | null | undefined;
  user_gt?: string | null | undefined;
  user_gte?: string | null | undefined;
  user_in?: Array<string> | null | undefined;
  user_lt?: string | null | undefined;
  user_lte?: string | null | undefined;
  user_not?: string | null | undefined;
  user_not_contains?: string | null | undefined;
  user_not_in?: Array<string> | null | undefined;
  virtualAccount?: string | null | undefined;
  virtualAccount_?: VirtualAccount_Filter | null | undefined;
  virtualAccount_contains?: string | null | undefined;
  virtualAccount_contains_nocase?: string | null | undefined;
  virtualAccount_ends_with?: string | null | undefined;
  virtualAccount_ends_with_nocase?: string | null | undefined;
  virtualAccount_gt?: string | null | undefined;
  virtualAccount_gte?: string | null | undefined;
  virtualAccount_in?: Array<string> | null | undefined;
  virtualAccount_lt?: string | null | undefined;
  virtualAccount_lte?: string | null | undefined;
  virtualAccount_not?: string | null | undefined;
  virtualAccount_not_contains?: string | null | undefined;
  virtualAccount_not_contains_nocase?: string | null | undefined;
  virtualAccount_not_ends_with?: string | null | undefined;
  virtualAccount_not_ends_with_nocase?: string | null | undefined;
  virtualAccount_not_in?: Array<string> | null | undefined;
  virtualAccount_not_starts_with?: string | null | undefined;
  virtualAccount_not_starts_with_nocase?: string | null | undefined;
  virtualAccount_starts_with?: string | null | undefined;
  virtualAccount_starts_with_nocase?: string | null | undefined;
  withdraw?: string | null | undefined;
  withdraw_gt?: string | null | undefined;
  withdraw_gte?: string | null | undefined;
  withdraw_in?: Array<string> | null | undefined;
  withdraw_lt?: string | null | undefined;
  withdraw_lte?: string | null | undefined;
  withdraw_not?: string | null | undefined;
  withdraw_not_in?: Array<string> | null | undefined;
};

export type Affiliate_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  accountManager?: string | null | undefined;
  accountManager_contains?: string | null | undefined;
  accountManager_gt?: string | null | undefined;
  accountManager_gte?: string | null | undefined;
  accountManager_in?: Array<string> | null | undefined;
  accountManager_lt?: string | null | undefined;
  accountManager_lte?: string | null | undefined;
  accountManager_not?: string | null | undefined;
  accountManager_not_contains?: string | null | undefined;
  accountManager_not_in?: Array<string> | null | undefined;
  address?: string | null | undefined;
  address_contains?: string | null | undefined;
  address_gt?: string | null | undefined;
  address_gte?: string | null | undefined;
  address_in?: Array<string> | null | undefined;
  address_lt?: string | null | undefined;
  address_lte?: string | null | undefined;
  address_not?: string | null | undefined;
  address_not_contains?: string | null | undefined;
  address_not_in?: Array<string> | null | undefined;
  admin?: string | null | undefined;
  admin_contains?: string | null | undefined;
  admin_gt?: string | null | undefined;
  admin_gte?: string | null | undefined;
  admin_in?: Array<string> | null | undefined;
  admin_lt?: string | null | undefined;
  admin_lte?: string | null | undefined;
  admin_not?: string | null | undefined;
  admin_not_contains?: string | null | undefined;
  admin_not_in?: Array<string> | null | undefined;
  and?: Array<Affiliate_Filter | null | undefined> | null | undefined;
  brandColor?: string | null | undefined;
  brandColor_contains?: string | null | undefined;
  brandColor_contains_nocase?: string | null | undefined;
  brandColor_ends_with?: string | null | undefined;
  brandColor_ends_with_nocase?: string | null | undefined;
  brandColor_gt?: string | null | undefined;
  brandColor_gte?: string | null | undefined;
  brandColor_in?: Array<string> | null | undefined;
  brandColor_lt?: string | null | undefined;
  brandColor_lte?: string | null | undefined;
  brandColor_not?: string | null | undefined;
  brandColor_not_contains?: string | null | undefined;
  brandColor_not_contains_nocase?: string | null | undefined;
  brandColor_not_ends_with?: string | null | undefined;
  brandColor_not_ends_with_nocase?: string | null | undefined;
  brandColor_not_in?: Array<string> | null | undefined;
  brandColor_not_starts_with?: string | null | undefined;
  brandColor_not_starts_with_nocase?: string | null | undefined;
  brandColor_starts_with?: string | null | undefined;
  brandColor_starts_with_nocase?: string | null | undefined;
  expressRate?: string | null | undefined;
  expressRate_gt?: string | null | undefined;
  expressRate_gte?: string | null | undefined;
  expressRate_in?: Array<string> | null | undefined;
  expressRate_lt?: string | null | undefined;
  expressRate_lte?: string | null | undefined;
  expressRate_not?: string | null | undefined;
  expressRate_not_in?: Array<string> | null | undefined;
  feeClaims_?: FeeClaim_Filter | null | undefined;
  feeDistributor?: string | null | undefined;
  feeDistributor_contains?: string | null | undefined;
  feeDistributor_gt?: string | null | undefined;
  feeDistributor_gte?: string | null | undefined;
  feeDistributor_in?: Array<string> | null | undefined;
  feeDistributor_lt?: string | null | undefined;
  feeDistributor_lte?: string | null | undefined;
  feeDistributor_not?: string | null | undefined;
  feeDistributor_not_contains?: string | null | undefined;
  feeDistributor_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  name?: string | null | undefined;
  name_contains?: string | null | undefined;
  name_contains_nocase?: string | null | undefined;
  name_ends_with?: string | null | undefined;
  name_ends_with_nocase?: string | null | undefined;
  name_gt?: string | null | undefined;
  name_gte?: string | null | undefined;
  name_in?: Array<string> | null | undefined;
  name_lt?: string | null | undefined;
  name_lte?: string | null | undefined;
  name_not?: string | null | undefined;
  name_not_contains?: string | null | undefined;
  name_not_contains_nocase?: string | null | undefined;
  name_not_ends_with?: string | null | undefined;
  name_not_ends_with_nocase?: string | null | undefined;
  name_not_in?: Array<string> | null | undefined;
  name_not_starts_with?: string | null | undefined;
  name_not_starts_with_nocase?: string | null | undefined;
  name_starts_with?: string | null | undefined;
  name_starts_with_nocase?: string | null | undefined;
  or?: Array<Affiliate_Filter | null | undefined> | null | undefined;
  pendingAdmin?: string | null | undefined;
  pendingAdmin_contains?: string | null | undefined;
  pendingAdmin_gt?: string | null | undefined;
  pendingAdmin_gte?: string | null | undefined;
  pendingAdmin_in?: Array<string> | null | undefined;
  pendingAdmin_lt?: string | null | undefined;
  pendingAdmin_lte?: string | null | undefined;
  pendingAdmin_not?: string | null | undefined;
  pendingAdmin_not_contains?: string | null | undefined;
  pendingAdmin_not_in?: Array<string> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  stakeholdersUpdatePending?: boolean | null | undefined;
  stakeholdersUpdatePending_in?: Array<boolean> | null | undefined;
  stakeholdersUpdatePending_not?: boolean | null | undefined;
  stakeholdersUpdatePending_not_in?: Array<boolean> | null | undefined;
  status?: string | null | undefined;
  status_contains?: string | null | undefined;
  status_contains_nocase?: string | null | undefined;
  status_ends_with?: string | null | undefined;
  status_ends_with_nocase?: string | null | undefined;
  status_gt?: string | null | undefined;
  status_gte?: string | null | undefined;
  status_in?: Array<string> | null | undefined;
  status_lt?: string | null | undefined;
  status_lte?: string | null | undefined;
  status_not?: string | null | undefined;
  status_not_contains?: string | null | undefined;
  status_not_contains_nocase?: string | null | undefined;
  status_not_ends_with?: string | null | undefined;
  status_not_ends_with_nocase?: string | null | undefined;
  status_not_in?: Array<string> | null | undefined;
  status_not_starts_with?: string | null | undefined;
  status_not_starts_with_nocase?: string | null | undefined;
  status_starts_with?: string | null | undefined;
  status_starts_with_nocase?: string | null | undefined;
  subAccounts_?: SubAccount_Filter | null | undefined;
  symmioShare?: string | null | undefined;
  symmioShare_gt?: string | null | undefined;
  symmioShare_gte?: string | null | undefined;
  symmioShare_in?: Array<string> | null | undefined;
  symmioShare_lt?: string | null | undefined;
  symmioShare_lte?: string | null | undefined;
  symmioShare_not?: string | null | undefined;
  symmioShare_not_in?: Array<string> | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  updateTimestamp?: string | null | undefined;
  updateTimestamp_gt?: string | null | undefined;
  updateTimestamp_gte?: string | null | undefined;
  updateTimestamp_in?: Array<string> | null | undefined;
  updateTimestamp_lt?: string | null | undefined;
  updateTimestamp_lte?: string | null | undefined;
  updateTimestamp_not?: string | null | undefined;
  updateTimestamp_not_in?: Array<string> | null | undefined;
  virtualProvider?: string | null | undefined;
  virtualProvider_contains?: string | null | undefined;
  virtualProvider_gt?: string | null | undefined;
  virtualProvider_gte?: string | null | undefined;
  virtualProvider_in?: Array<string> | null | undefined;
  virtualProvider_lt?: string | null | undefined;
  virtualProvider_lte?: string | null | undefined;
  virtualProvider_not?: string | null | undefined;
  virtualProvider_not_contains?: string | null | undefined;
  virtualProvider_not_in?: Array<string> | null | undefined;
};

export type BlockChangedFilter = {
  number_gte: number;
};

export type FeeClaim_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  affiliate?: string | null | undefined;
  affiliate_?: Affiliate_Filter | null | undefined;
  affiliate_contains?: string | null | undefined;
  affiliate_contains_nocase?: string | null | undefined;
  affiliate_ends_with?: string | null | undefined;
  affiliate_ends_with_nocase?: string | null | undefined;
  affiliate_gt?: string | null | undefined;
  affiliate_gte?: string | null | undefined;
  affiliate_in?: Array<string> | null | undefined;
  affiliate_lt?: string | null | undefined;
  affiliate_lte?: string | null | undefined;
  affiliate_not?: string | null | undefined;
  affiliate_not_contains?: string | null | undefined;
  affiliate_not_contains_nocase?: string | null | undefined;
  affiliate_not_ends_with?: string | null | undefined;
  affiliate_not_ends_with_nocase?: string | null | undefined;
  affiliate_not_in?: Array<string> | null | undefined;
  affiliate_not_starts_with?: string | null | undefined;
  affiliate_not_starts_with_nocase?: string | null | undefined;
  affiliate_starts_with?: string | null | undefined;
  affiliate_starts_with_nocase?: string | null | undefined;
  amount?: string | null | undefined;
  amount_gt?: string | null | undefined;
  amount_gte?: string | null | undefined;
  amount_in?: Array<string> | null | undefined;
  amount_lt?: string | null | undefined;
  amount_lte?: string | null | undefined;
  amount_not?: string | null | undefined;
  amount_not_in?: Array<string> | null | undefined;
  and?: Array<FeeClaim_Filter | null | undefined> | null | undefined;
  blockNumber?: string | null | undefined;
  blockNumber_gt?: string | null | undefined;
  blockNumber_gte?: string | null | undefined;
  blockNumber_in?: Array<string> | null | undefined;
  blockNumber_lt?: string | null | undefined;
  blockNumber_lte?: string | null | undefined;
  blockNumber_not?: string | null | undefined;
  blockNumber_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  or?: Array<FeeClaim_Filter | null | undefined> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  symmio?: string | null | undefined;
  symmio_contains?: string | null | undefined;
  symmio_gt?: string | null | undefined;
  symmio_gte?: string | null | undefined;
  symmio_in?: Array<string> | null | undefined;
  symmio_lt?: string | null | undefined;
  symmio_lte?: string | null | undefined;
  symmio_not?: string | null | undefined;
  symmio_not_contains?: string | null | undefined;
  symmio_not_in?: Array<string> | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  transaction?: string | null | undefined;
  transaction_contains?: string | null | undefined;
  transaction_gt?: string | null | undefined;
  transaction_gte?: string | null | undefined;
  transaction_in?: Array<string> | null | undefined;
  transaction_lt?: string | null | undefined;
  transaction_lte?: string | null | undefined;
  transaction_not?: string | null | undefined;
  transaction_not_contains?: string | null | undefined;
  transaction_not_in?: Array<string> | null | undefined;
};

export type FundingIndexCheckpoint_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  accumulatedLongRate?: string | null | undefined;
  accumulatedLongRate_gt?: string | null | undefined;
  accumulatedLongRate_gte?: string | null | undefined;
  accumulatedLongRate_in?: Array<string> | null | undefined;
  accumulatedLongRate_lt?: string | null | undefined;
  accumulatedLongRate_lte?: string | null | undefined;
  accumulatedLongRate_not?: string | null | undefined;
  accumulatedLongRate_not_in?: Array<string> | null | undefined;
  accumulatedShortRate?: string | null | undefined;
  accumulatedShortRate_gt?: string | null | undefined;
  accumulatedShortRate_gte?: string | null | undefined;
  accumulatedShortRate_in?: Array<string> | null | undefined;
  accumulatedShortRate_lt?: string | null | undefined;
  accumulatedShortRate_lte?: string | null | undefined;
  accumulatedShortRate_not?: string | null | undefined;
  accumulatedShortRate_not_in?: Array<string> | null | undefined;
  and?: Array<FundingIndexCheckpoint_Filter | null | undefined> | null | undefined;
  blockNumber?: string | null | undefined;
  blockNumber_gt?: string | null | undefined;
  blockNumber_gte?: string | null | undefined;
  blockNumber_in?: Array<string> | null | undefined;
  blockNumber_lt?: string | null | undefined;
  blockNumber_lte?: string | null | undefined;
  blockNumber_not?: string | null | undefined;
  blockNumber_not_in?: Array<string> | null | undefined;
  currentLongRate?: string | null | undefined;
  currentLongRate_gt?: string | null | undefined;
  currentLongRate_gte?: string | null | undefined;
  currentLongRate_in?: Array<string> | null | undefined;
  currentLongRate_lt?: string | null | undefined;
  currentLongRate_lte?: string | null | undefined;
  currentLongRate_not?: string | null | undefined;
  currentLongRate_not_in?: Array<string> | null | undefined;
  currentShortRate?: string | null | undefined;
  currentShortRate_gt?: string | null | undefined;
  currentShortRate_gte?: string | null | undefined;
  currentShortRate_in?: Array<string> | null | undefined;
  currentShortRate_lt?: string | null | undefined;
  currentShortRate_lte?: string | null | undefined;
  currentShortRate_not?: string | null | undefined;
  currentShortRate_not_in?: Array<string> | null | undefined;
  epochDuration?: string | null | undefined;
  epochDuration_gt?: string | null | undefined;
  epochDuration_gte?: string | null | undefined;
  epochDuration_in?: Array<string> | null | undefined;
  epochDuration_lt?: string | null | undefined;
  epochDuration_lte?: string | null | undefined;
  epochDuration_not?: string | null | undefined;
  epochDuration_not_in?: Array<string> | null | undefined;
  eventType?: string | null | undefined;
  eventType_contains?: string | null | undefined;
  eventType_contains_nocase?: string | null | undefined;
  eventType_ends_with?: string | null | undefined;
  eventType_ends_with_nocase?: string | null | undefined;
  eventType_gt?: string | null | undefined;
  eventType_gte?: string | null | undefined;
  eventType_in?: Array<string> | null | undefined;
  eventType_lt?: string | null | undefined;
  eventType_lte?: string | null | undefined;
  eventType_not?: string | null | undefined;
  eventType_not_contains?: string | null | undefined;
  eventType_not_contains_nocase?: string | null | undefined;
  eventType_not_ends_with?: string | null | undefined;
  eventType_not_ends_with_nocase?: string | null | undefined;
  eventType_not_in?: Array<string> | null | undefined;
  eventType_not_starts_with?: string | null | undefined;
  eventType_not_starts_with_nocase?: string | null | undefined;
  eventType_starts_with?: string | null | undefined;
  eventType_starts_with_nocase?: string | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  lastUpdatedEpoch?: string | null | undefined;
  lastUpdatedEpoch_gt?: string | null | undefined;
  lastUpdatedEpoch_gte?: string | null | undefined;
  lastUpdatedEpoch_in?: Array<string> | null | undefined;
  lastUpdatedEpoch_lt?: string | null | undefined;
  lastUpdatedEpoch_lte?: string | null | undefined;
  lastUpdatedEpoch_not?: string | null | undefined;
  lastUpdatedEpoch_not_in?: Array<string> | null | undefined;
  lastUpdatedTimestamp?: string | null | undefined;
  lastUpdatedTimestamp_gt?: string | null | undefined;
  lastUpdatedTimestamp_gte?: string | null | undefined;
  lastUpdatedTimestamp_in?: Array<string> | null | undefined;
  lastUpdatedTimestamp_lt?: string | null | undefined;
  lastUpdatedTimestamp_lte?: string | null | undefined;
  lastUpdatedTimestamp_not?: string | null | undefined;
  lastUpdatedTimestamp_not_in?: Array<string> | null | undefined;
  marketPrice?: string | null | undefined;
  marketPrice_gt?: string | null | undefined;
  marketPrice_gte?: string | null | undefined;
  marketPrice_in?: Array<string> | null | undefined;
  marketPrice_lt?: string | null | undefined;
  marketPrice_lte?: string | null | undefined;
  marketPrice_not?: string | null | undefined;
  marketPrice_not_in?: Array<string> | null | undefined;
  or?: Array<FundingIndexCheckpoint_Filter | null | undefined> | null | undefined;
  partyB?: string | null | undefined;
  partyB_contains?: string | null | undefined;
  partyB_gt?: string | null | undefined;
  partyB_gte?: string | null | undefined;
  partyB_in?: Array<string> | null | undefined;
  partyB_lt?: string | null | undefined;
  partyB_lte?: string | null | undefined;
  partyB_not?: string | null | undefined;
  partyB_not_contains?: string | null | undefined;
  partyB_not_in?: Array<string> | null | undefined;
  rawLongRate?: string | null | undefined;
  rawLongRate_gt?: string | null | undefined;
  rawLongRate_gte?: string | null | undefined;
  rawLongRate_in?: Array<string> | null | undefined;
  rawLongRate_lt?: string | null | undefined;
  rawLongRate_lte?: string | null | undefined;
  rawLongRate_not?: string | null | undefined;
  rawLongRate_not_in?: Array<string> | null | undefined;
  rawShortRate?: string | null | undefined;
  rawShortRate_gt?: string | null | undefined;
  rawShortRate_gte?: string | null | undefined;
  rawShortRate_in?: Array<string> | null | undefined;
  rawShortRate_lt?: string | null | undefined;
  rawShortRate_lte?: string | null | undefined;
  rawShortRate_not?: string | null | undefined;
  rawShortRate_not_in?: Array<string> | null | undefined;
  snapshotLongFee?: string | null | undefined;
  snapshotLongFee_gt?: string | null | undefined;
  snapshotLongFee_gte?: string | null | undefined;
  snapshotLongFee_in?: Array<string> | null | undefined;
  snapshotLongFee_lt?: string | null | undefined;
  snapshotLongFee_lte?: string | null | undefined;
  snapshotLongFee_not?: string | null | undefined;
  snapshotLongFee_not_in?: Array<string> | null | undefined;
  snapshotShortFee?: string | null | undefined;
  snapshotShortFee_gt?: string | null | undefined;
  snapshotShortFee_gte?: string | null | undefined;
  snapshotShortFee_in?: Array<string> | null | undefined;
  snapshotShortFee_lt?: string | null | undefined;
  snapshotShortFee_lte?: string | null | undefined;
  snapshotShortFee_not?: string | null | undefined;
  snapshotShortFee_not_in?: Array<string> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  startEpoch?: string | null | undefined;
  startEpochTimestamp?: string | null | undefined;
  startEpochTimestamp_gt?: string | null | undefined;
  startEpochTimestamp_gte?: string | null | undefined;
  startEpochTimestamp_in?: Array<string> | null | undefined;
  startEpochTimestamp_lt?: string | null | undefined;
  startEpochTimestamp_lte?: string | null | undefined;
  startEpochTimestamp_not?: string | null | undefined;
  startEpochTimestamp_not_in?: Array<string> | null | undefined;
  startEpoch_gt?: string | null | undefined;
  startEpoch_gte?: string | null | undefined;
  startEpoch_in?: Array<string> | null | undefined;
  startEpoch_lt?: string | null | undefined;
  startEpoch_lte?: string | null | undefined;
  startEpoch_not?: string | null | undefined;
  startEpoch_not_in?: Array<string> | null | undefined;
  symbolId?: string | null | undefined;
  symbolId_gt?: string | null | undefined;
  symbolId_gte?: string | null | undefined;
  symbolId_in?: Array<string> | null | undefined;
  symbolId_lt?: string | null | undefined;
  symbolId_lte?: string | null | undefined;
  symbolId_not?: string | null | undefined;
  symbolId_not_in?: Array<string> | null | undefined;
  symbolName?: string | null | undefined;
  symbolName_contains?: string | null | undefined;
  symbolName_contains_nocase?: string | null | undefined;
  symbolName_ends_with?: string | null | undefined;
  symbolName_ends_with_nocase?: string | null | undefined;
  symbolName_gt?: string | null | undefined;
  symbolName_gte?: string | null | undefined;
  symbolName_in?: Array<string> | null | undefined;
  symbolName_lt?: string | null | undefined;
  symbolName_lte?: string | null | undefined;
  symbolName_not?: string | null | undefined;
  symbolName_not_contains?: string | null | undefined;
  symbolName_not_contains_nocase?: string | null | undefined;
  symbolName_not_ends_with?: string | null | undefined;
  symbolName_not_ends_with_nocase?: string | null | undefined;
  symbolName_not_in?: Array<string> | null | undefined;
  symbolName_not_starts_with?: string | null | undefined;
  symbolName_not_starts_with_nocase?: string | null | undefined;
  symbolName_starts_with?: string | null | undefined;
  symbolName_starts_with_nocase?: string | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  transaction?: string | null | undefined;
  transaction_contains?: string | null | undefined;
  transaction_gt?: string | null | undefined;
  transaction_gte?: string | null | undefined;
  transaction_in?: Array<string> | null | undefined;
  transaction_lt?: string | null | undefined;
  transaction_lte?: string | null | undefined;
  transaction_not?: string | null | undefined;
  transaction_not_contains?: string | null | undefined;
  transaction_not_in?: Array<string> | null | undefined;
};

export type FundingIndexCheckpoint_OrderBy =
  | "accumulatedLongRate"
  | "accumulatedShortRate"
  | "blockNumber"
  | "currentLongRate"
  | "currentShortRate"
  | "epochDuration"
  | "eventType"
  | "id"
  | "lastUpdatedEpoch"
  | "lastUpdatedTimestamp"
  | "marketPrice"
  | "partyB"
  | "rawLongRate"
  | "rawShortRate"
  | "snapshotLongFee"
  | "snapshotShortFee"
  | "source"
  | "startEpoch"
  | "startEpochTimestamp"
  | "symbolId"
  | "symbolName"
  | "timestamp"
  | "transaction";

export type LiquidationDetail_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  accountLayerSource?: string | null | undefined;
  accountLayerSource_contains?: string | null | undefined;
  accountLayerSource_gt?: string | null | undefined;
  accountLayerSource_gte?: string | null | undefined;
  accountLayerSource_in?: Array<string> | null | undefined;
  accountLayerSource_lt?: string | null | undefined;
  accountLayerSource_lte?: string | null | undefined;
  accountLayerSource_not?: string | null | undefined;
  accountLayerSource_not_contains?: string | null | undefined;
  accountLayerSource_not_in?: Array<string> | null | undefined;
  affiliate?: string | null | undefined;
  affiliate_contains?: string | null | undefined;
  affiliate_gt?: string | null | undefined;
  affiliate_gte?: string | null | undefined;
  affiliate_in?: Array<string> | null | undefined;
  affiliate_lt?: string | null | undefined;
  affiliate_lte?: string | null | undefined;
  affiliate_not?: string | null | undefined;
  affiliate_not_contains?: string | null | undefined;
  affiliate_not_in?: Array<string> | null | undefined;
  allocatedBalance?: string | null | undefined;
  allocatedBalance_gt?: string | null | undefined;
  allocatedBalance_gte?: string | null | undefined;
  allocatedBalance_in?: Array<string> | null | undefined;
  allocatedBalance_lt?: string | null | undefined;
  allocatedBalance_lte?: string | null | undefined;
  allocatedBalance_not?: string | null | undefined;
  allocatedBalance_not_in?: Array<string> | null | undefined;
  and?: Array<LiquidationDetail_Filter | null | undefined> | null | undefined;
  autoTakeover?: boolean | null | undefined;
  autoTakeover_in?: Array<boolean> | null | undefined;
  autoTakeover_not?: boolean | null | undefined;
  autoTakeover_not_in?: Array<boolean> | null | undefined;
  coreSource?: string | null | undefined;
  coreSource_contains?: string | null | undefined;
  coreSource_gt?: string | null | undefined;
  coreSource_gte?: string | null | undefined;
  coreSource_in?: Array<string> | null | undefined;
  coreSource_lt?: string | null | undefined;
  coreSource_lte?: string | null | undefined;
  coreSource_not?: string | null | undefined;
  coreSource_not_contains?: string | null | undefined;
  coreSource_not_in?: Array<string> | null | undefined;
  deferredBalance?: string | null | undefined;
  deferredBalance_gt?: string | null | undefined;
  deferredBalance_gte?: string | null | undefined;
  deferredBalance_in?: Array<string> | null | undefined;
  deferredBalance_lt?: string | null | undefined;
  deferredBalance_lte?: string | null | undefined;
  deferredBalance_not?: string | null | undefined;
  deferredBalance_not_in?: Array<string> | null | undefined;
  deficit?: string | null | undefined;
  deficit_gt?: string | null | undefined;
  deficit_gte?: string | null | undefined;
  deficit_in?: Array<string> | null | undefined;
  deficit_lt?: string | null | undefined;
  deficit_lte?: string | null | undefined;
  deficit_not?: string | null | undefined;
  deficit_not_in?: Array<string> | null | undefined;
  deploymentId?: string | null | undefined;
  deploymentId_contains?: string | null | undefined;
  deploymentId_contains_nocase?: string | null | undefined;
  deploymentId_ends_with?: string | null | undefined;
  deploymentId_ends_with_nocase?: string | null | undefined;
  deploymentId_gt?: string | null | undefined;
  deploymentId_gte?: string | null | undefined;
  deploymentId_in?: Array<string> | null | undefined;
  deploymentId_lt?: string | null | undefined;
  deploymentId_lte?: string | null | undefined;
  deploymentId_not?: string | null | undefined;
  deploymentId_not_contains?: string | null | undefined;
  deploymentId_not_contains_nocase?: string | null | undefined;
  deploymentId_not_ends_with?: string | null | undefined;
  deploymentId_not_ends_with_nocase?: string | null | undefined;
  deploymentId_not_in?: Array<string> | null | undefined;
  deploymentId_not_starts_with?: string | null | undefined;
  deploymentId_not_starts_with_nocase?: string | null | undefined;
  deploymentId_starts_with?: string | null | undefined;
  deploymentId_starts_with_nocase?: string | null | undefined;
  disputed?: boolean | null | undefined;
  disputed_in?: Array<boolean> | null | undefined;
  disputed_not?: boolean | null | undefined;
  disputed_not_in?: Array<boolean> | null | undefined;
  events_?: LiquidationEvent_Filter | null | undefined;
  freeBalance?: string | null | undefined;
  freeBalance_gt?: string | null | undefined;
  freeBalance_gte?: string | null | undefined;
  freeBalance_in?: Array<string> | null | undefined;
  freeBalance_lt?: string | null | undefined;
  freeBalance_lte?: string | null | undefined;
  freeBalance_not?: string | null | undefined;
  freeBalance_not_in?: Array<string> | null | undefined;
  freeMarginAtStart?: string | null | undefined;
  freeMarginAtStart_gt?: string | null | undefined;
  freeMarginAtStart_gte?: string | null | undefined;
  freeMarginAtStart_in?: Array<string> | null | undefined;
  freeMarginAtStart_lt?: string | null | undefined;
  freeMarginAtStart_lte?: string | null | undefined;
  freeMarginAtStart_not?: string | null | undefined;
  freeMarginAtStart_not_in?: Array<string> | null | undefined;
  fullyLiquidated?: boolean | null | undefined;
  fullyLiquidatedTimestamp?: string | null | undefined;
  fullyLiquidatedTimestamp_gt?: string | null | undefined;
  fullyLiquidatedTimestamp_gte?: string | null | undefined;
  fullyLiquidatedTimestamp_in?: Array<string> | null | undefined;
  fullyLiquidatedTimestamp_lt?: string | null | undefined;
  fullyLiquidatedTimestamp_lte?: string | null | undefined;
  fullyLiquidatedTimestamp_not?: string | null | undefined;
  fullyLiquidatedTimestamp_not_in?: Array<string> | null | undefined;
  fullyLiquidated_in?: Array<boolean> | null | undefined;
  fullyLiquidated_not?: boolean | null | undefined;
  fullyLiquidated_not_in?: Array<boolean> | null | undefined;
  globalCounter?: string | null | undefined;
  globalCounter_gt?: string | null | undefined;
  globalCounter_gte?: string | null | undefined;
  globalCounter_in?: Array<string> | null | undefined;
  globalCounter_lt?: string | null | undefined;
  globalCounter_lte?: string | null | undefined;
  globalCounter_not?: string | null | undefined;
  globalCounter_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  involvedPartyBCounts?: string | null | undefined;
  involvedPartyBCounts_gt?: string | null | undefined;
  involvedPartyBCounts_gte?: string | null | undefined;
  involvedPartyBCounts_in?: Array<string> | null | undefined;
  involvedPartyBCounts_lt?: string | null | undefined;
  involvedPartyBCounts_lte?: string | null | undefined;
  involvedPartyBCounts_not?: string | null | undefined;
  involvedPartyBCounts_not_in?: Array<string> | null | undefined;
  liquidationAllocatedBalance?: string | null | undefined;
  liquidationAllocatedBalance_gt?: string | null | undefined;
  liquidationAllocatedBalance_gte?: string | null | undefined;
  liquidationAllocatedBalance_in?: Array<string> | null | undefined;
  liquidationAllocatedBalance_lt?: string | null | undefined;
  liquidationAllocatedBalance_lte?: string | null | undefined;
  liquidationAllocatedBalance_not?: string | null | undefined;
  liquidationAllocatedBalance_not_in?: Array<string> | null | undefined;
  liquidationBlockNumber?: string | null | undefined;
  liquidationBlockNumber_gt?: string | null | undefined;
  liquidationBlockNumber_gte?: string | null | undefined;
  liquidationBlockNumber_in?: Array<string> | null | undefined;
  liquidationBlockNumber_lt?: string | null | undefined;
  liquidationBlockNumber_lte?: string | null | undefined;
  liquidationBlockNumber_not?: string | null | undefined;
  liquidationBlockNumber_not_in?: Array<string> | null | undefined;
  liquidationEscrow?: string | null | undefined;
  liquidationEscrow_gt?: string | null | undefined;
  liquidationEscrow_gte?: string | null | undefined;
  liquidationEscrow_in?: Array<string> | null | undefined;
  liquidationEscrow_lt?: string | null | undefined;
  liquidationEscrow_lte?: string | null | undefined;
  liquidationEscrow_not?: string | null | undefined;
  liquidationEscrow_not_in?: Array<string> | null | undefined;
  liquidationFee?: string | null | undefined;
  liquidationFee_gt?: string | null | undefined;
  liquidationFee_gte?: string | null | undefined;
  liquidationFee_in?: Array<string> | null | undefined;
  liquidationFee_lt?: string | null | undefined;
  liquidationFee_lte?: string | null | undefined;
  liquidationFee_not?: string | null | undefined;
  liquidationFee_not_in?: Array<string> | null | undefined;
  liquidationId?: string | null | undefined;
  liquidationId_contains?: string | null | undefined;
  liquidationId_gt?: string | null | undefined;
  liquidationId_gte?: string | null | undefined;
  liquidationId_in?: Array<string> | null | undefined;
  liquidationId_lt?: string | null | undefined;
  liquidationId_lte?: string | null | undefined;
  liquidationId_not?: string | null | undefined;
  liquidationId_not_contains?: string | null | undefined;
  liquidationId_not_in?: Array<string> | null | undefined;
  liquidationStartTransaction?: string | null | undefined;
  liquidationStartTransaction_contains?: string | null | undefined;
  liquidationStartTransaction_gt?: string | null | undefined;
  liquidationStartTransaction_gte?: string | null | undefined;
  liquidationStartTransaction_in?: Array<string> | null | undefined;
  liquidationStartTransaction_lt?: string | null | undefined;
  liquidationStartTransaction_lte?: string | null | undefined;
  liquidationStartTransaction_not?: string | null | undefined;
  liquidationStartTransaction_not_contains?: string | null | undefined;
  liquidationStartTransaction_not_in?: Array<string> | null | undefined;
  liquidationTimestamp?: string | null | undefined;
  liquidationTimestamp_gt?: string | null | undefined;
  liquidationTimestamp_gte?: string | null | undefined;
  liquidationTimestamp_in?: Array<string> | null | undefined;
  liquidationTimestamp_lt?: string | null | undefined;
  liquidationTimestamp_lte?: string | null | undefined;
  liquidationTimestamp_not?: string | null | undefined;
  liquidationTimestamp_not_in?: Array<string> | null | undefined;
  liquidationType?: number | null | undefined;
  liquidationType_gt?: number | null | undefined;
  liquidationType_gte?: number | null | undefined;
  liquidationType_in?: Array<number> | null | undefined;
  liquidationType_lt?: number | null | undefined;
  liquidationType_lte?: number | null | undefined;
  liquidationType_not?: number | null | undefined;
  liquidationType_not_in?: Array<number> | null | undefined;
  liquidator?: string | null | undefined;
  liquidator_contains?: string | null | undefined;
  liquidator_gt?: string | null | undefined;
  liquidator_gte?: string | null | undefined;
  liquidator_in?: Array<string> | null | undefined;
  liquidator_lt?: string | null | undefined;
  liquidator_lte?: string | null | undefined;
  liquidator_not?: string | null | undefined;
  liquidator_not_contains?: string | null | undefined;
  liquidator_not_in?: Array<string> | null | undefined;
  lockedCva?: string | null | undefined;
  lockedCva_gt?: string | null | undefined;
  lockedCva_gte?: string | null | undefined;
  lockedCva_in?: Array<string> | null | undefined;
  lockedCva_lt?: string | null | undefined;
  lockedCva_lte?: string | null | undefined;
  lockedCva_not?: string | null | undefined;
  lockedCva_not_in?: Array<string> | null | undefined;
  lockedLf?: string | null | undefined;
  lockedLf_gt?: string | null | undefined;
  lockedLf_gte?: string | null | undefined;
  lockedLf_in?: Array<string> | null | undefined;
  lockedLf_lt?: string | null | undefined;
  lockedLf_lte?: string | null | undefined;
  lockedLf_not?: string | null | undefined;
  lockedLf_not_in?: Array<string> | null | undefined;
  lockedPartyAmm?: string | null | undefined;
  lockedPartyAmm_gt?: string | null | undefined;
  lockedPartyAmm_gte?: string | null | undefined;
  lockedPartyAmm_in?: Array<string> | null | undefined;
  lockedPartyAmm_lt?: string | null | undefined;
  lockedPartyAmm_lte?: string | null | undefined;
  lockedPartyAmm_not?: string | null | undefined;
  lockedPartyAmm_not_in?: Array<string> | null | undefined;
  lockedPartyBmm?: string | null | undefined;
  lockedPartyBmm_gt?: string | null | undefined;
  lockedPartyBmm_gte?: string | null | undefined;
  lockedPartyBmm_in?: Array<string> | null | undefined;
  lockedPartyBmm_lt?: string | null | undefined;
  lockedPartyBmm_lte?: string | null | undefined;
  lockedPartyBmm_not?: string | null | undefined;
  lockedPartyBmm_not_in?: Array<string> | null | undefined;
  lossRestsAt?: string | null | undefined;
  lossRestsAt_gt?: string | null | undefined;
  lossRestsAt_gte?: string | null | undefined;
  lossRestsAt_in?: Array<string> | null | undefined;
  lossRestsAt_lt?: string | null | undefined;
  lossRestsAt_lte?: string | null | undefined;
  lossRestsAt_not?: string | null | undefined;
  lossRestsAt_not_in?: Array<string> | null | undefined;
  or?: Array<LiquidationDetail_Filter | null | undefined> | null | undefined;
  owner?: string | null | undefined;
  owner_contains?: string | null | undefined;
  owner_gt?: string | null | undefined;
  owner_gte?: string | null | undefined;
  owner_in?: Array<string> | null | undefined;
  owner_lt?: string | null | undefined;
  owner_lte?: string | null | undefined;
  owner_not?: string | null | undefined;
  owner_not_contains?: string | null | undefined;
  owner_not_in?: Array<string> | null | undefined;
  paidCva?: string | null | undefined;
  paidCva_gt?: string | null | undefined;
  paidCva_gte?: string | null | undefined;
  paidCva_in?: Array<string> | null | undefined;
  paidCva_lt?: string | null | undefined;
  paidCva_lte?: string | null | undefined;
  paidCva_not?: string | null | undefined;
  paidCva_not_in?: Array<string> | null | undefined;
  paidLf?: string | null | undefined;
  paidLf_gt?: string | null | undefined;
  paidLf_gte?: string | null | undefined;
  paidLf_in?: Array<string> | null | undefined;
  paidLf_lt?: string | null | undefined;
  paidLf_lte?: string | null | undefined;
  paidLf_not?: string | null | undefined;
  paidLf_not_in?: Array<string> | null | undefined;
  partyA?: string | null | undefined;
  partyAAccount?: string | null | undefined;
  partyAAccount_?: Account_Filter | null | undefined;
  partyAAccount_contains?: string | null | undefined;
  partyAAccount_contains_nocase?: string | null | undefined;
  partyAAccount_ends_with?: string | null | undefined;
  partyAAccount_ends_with_nocase?: string | null | undefined;
  partyAAccount_gt?: string | null | undefined;
  partyAAccount_gte?: string | null | undefined;
  partyAAccount_in?: Array<string> | null | undefined;
  partyAAccount_lt?: string | null | undefined;
  partyAAccount_lte?: string | null | undefined;
  partyAAccount_not?: string | null | undefined;
  partyAAccount_not_contains?: string | null | undefined;
  partyAAccount_not_contains_nocase?: string | null | undefined;
  partyAAccount_not_ends_with?: string | null | undefined;
  partyAAccount_not_ends_with_nocase?: string | null | undefined;
  partyAAccount_not_in?: Array<string> | null | undefined;
  partyAAccount_not_starts_with?: string | null | undefined;
  partyAAccount_not_starts_with_nocase?: string | null | undefined;
  partyAAccount_starts_with?: string | null | undefined;
  partyAAccount_starts_with_nocase?: string | null | undefined;
  partyAAccumulatedUpnl?: string | null | undefined;
  partyAAccumulatedUpnl_gt?: string | null | undefined;
  partyAAccumulatedUpnl_gte?: string | null | undefined;
  partyAAccumulatedUpnl_in?: Array<string> | null | undefined;
  partyAAccumulatedUpnl_lt?: string | null | undefined;
  partyAAccumulatedUpnl_lte?: string | null | undefined;
  partyAAccumulatedUpnl_not?: string | null | undefined;
  partyAAccumulatedUpnl_not_in?: Array<string> | null | undefined;
  partyA_contains?: string | null | undefined;
  partyA_gt?: string | null | undefined;
  partyA_gte?: string | null | undefined;
  partyA_in?: Array<string> | null | undefined;
  partyA_lt?: string | null | undefined;
  partyA_lte?: string | null | undefined;
  partyA_not?: string | null | undefined;
  partyA_not_contains?: string | null | undefined;
  partyA_not_in?: Array<string> | null | undefined;
  potentialLf?: string | null | undefined;
  potentialLf_gt?: string | null | undefined;
  potentialLf_gte?: string | null | undefined;
  potentialLf_in?: Array<string> | null | undefined;
  potentialLf_lt?: string | null | undefined;
  potentialLf_lte?: string | null | undefined;
  potentialLf_not?: string | null | undefined;
  potentialLf_not_in?: Array<string> | null | undefined;
  reimbursement?: string | null | undefined;
  reimbursement_gt?: string | null | undefined;
  reimbursement_gte?: string | null | undefined;
  reimbursement_in?: Array<string> | null | undefined;
  reimbursement_lt?: string | null | undefined;
  reimbursement_lte?: string | null | undefined;
  reimbursement_not?: string | null | undefined;
  reimbursement_not_in?: Array<string> | null | undefined;
  settled?: boolean | null | undefined;
  settledAmounts?: Array<string> | null | undefined;
  settledAmounts_contains?: Array<string> | null | undefined;
  settledAmounts_not?: Array<string> | null | undefined;
  settledAmounts_not_contains?: Array<string> | null | undefined;
  settledPartyBs?: Array<string> | null | undefined;
  settledPartyBs_contains?: Array<string> | null | undefined;
  settledPartyBs_not?: Array<string> | null | undefined;
  settledPartyBs_not_contains?: Array<string> | null | undefined;
  settled_in?: Array<boolean> | null | undefined;
  settled_not?: boolean | null | undefined;
  settled_not_in?: Array<boolean> | null | undefined;
  settlementActualAmounts?: Array<string> | null | undefined;
  settlementActualAmounts_contains?: Array<string> | null | undefined;
  settlementActualAmounts_not?: Array<string> | null | undefined;
  settlementActualAmounts_not_contains?: Array<string> | null | undefined;
  settlementAttributionComplete?: boolean | null | undefined;
  settlementAttributionComplete_in?: Array<boolean> | null | undefined;
  settlementAttributionComplete_not?: boolean | null | undefined;
  settlementAttributionComplete_not_in?: Array<boolean> | null | undefined;
  settlementCvaReturned?: Array<string> | null | undefined;
  settlementCvaReturned_contains?: Array<string> | null | undefined;
  settlementCvaReturned_not?: Array<string> | null | undefined;
  settlementCvaReturned_not_contains?: Array<string> | null | undefined;
  settlementExpectedAmounts?: Array<string> | null | undefined;
  settlementExpectedAmounts_contains?: Array<string> | null | undefined;
  settlementExpectedAmounts_not?: Array<string> | null | undefined;
  settlementExpectedAmounts_not_contains?: Array<string> | null | undefined;
  settlementModes?: Array<string> | null | undefined;
  settlementModes_contains?: Array<string> | null | undefined;
  settlementModes_contains_nocase?: Array<string> | null | undefined;
  settlementModes_not?: Array<string> | null | undefined;
  settlementModes_not_contains?: Array<string> | null | undefined;
  settlementModes_not_contains_nocase?: Array<string> | null | undefined;
  settlementPartyBs?: Array<string> | null | undefined;
  settlementPartyBs_contains?: Array<string> | null | undefined;
  settlementPartyBs_not?: Array<string> | null | undefined;
  settlementPartyBs_not_contains?: Array<string> | null | undefined;
  settlementReserveContributions?: Array<string> | null | undefined;
  settlementReserveContributions_contains?: Array<string> | null | undefined;
  settlementReserveContributions_not?: Array<string> | null | undefined;
  settlementReserveContributions_not_contains?: Array<string> | null | undefined;
  settlementStates?: Array<string> | null | undefined;
  settlementStates_contains?: Array<string> | null | undefined;
  settlementStates_contains_nocase?: Array<string> | null | undefined;
  settlementStates_not?: Array<string> | null | undefined;
  settlementStates_not_contains?: Array<string> | null | undefined;
  settlementStates_not_contains_nocase?: Array<string> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  subAccountRef?: string | null | undefined;
  subAccountRef_?: SubAccount_Filter | null | undefined;
  subAccountRef_contains?: string | null | undefined;
  subAccountRef_contains_nocase?: string | null | undefined;
  subAccountRef_ends_with?: string | null | undefined;
  subAccountRef_ends_with_nocase?: string | null | undefined;
  subAccountRef_gt?: string | null | undefined;
  subAccountRef_gte?: string | null | undefined;
  subAccountRef_in?: Array<string> | null | undefined;
  subAccountRef_lt?: string | null | undefined;
  subAccountRef_lte?: string | null | undefined;
  subAccountRef_not?: string | null | undefined;
  subAccountRef_not_contains?: string | null | undefined;
  subAccountRef_not_contains_nocase?: string | null | undefined;
  subAccountRef_not_ends_with?: string | null | undefined;
  subAccountRef_not_ends_with_nocase?: string | null | undefined;
  subAccountRef_not_in?: Array<string> | null | undefined;
  subAccountRef_not_starts_with?: string | null | undefined;
  subAccountRef_not_starts_with_nocase?: string | null | undefined;
  subAccountRef_starts_with?: string | null | undefined;
  subAccountRef_starts_with_nocase?: string | null | undefined;
  takeover?: boolean | null | undefined;
  takeoverSettled?: boolean | null | undefined;
  takeoverSettledTimestamp?: string | null | undefined;
  takeoverSettledTimestamp_gt?: string | null | undefined;
  takeoverSettledTimestamp_gte?: string | null | undefined;
  takeoverSettledTimestamp_in?: Array<string> | null | undefined;
  takeoverSettledTimestamp_lt?: string | null | undefined;
  takeoverSettledTimestamp_lte?: string | null | undefined;
  takeoverSettledTimestamp_not?: string | null | undefined;
  takeoverSettledTimestamp_not_in?: Array<string> | null | undefined;
  takeoverSettled_in?: Array<boolean> | null | undefined;
  takeoverSettled_not?: boolean | null | undefined;
  takeoverSettled_not_in?: Array<boolean> | null | undefined;
  takeoverTimestamp?: string | null | undefined;
  takeoverTimestamp_gt?: string | null | undefined;
  takeoverTimestamp_gte?: string | null | undefined;
  takeoverTimestamp_in?: Array<string> | null | undefined;
  takeoverTimestamp_lt?: string | null | undefined;
  takeoverTimestamp_lte?: string | null | undefined;
  takeoverTimestamp_not?: string | null | undefined;
  takeoverTimestamp_not_in?: Array<string> | null | undefined;
  takeover_in?: Array<boolean> | null | undefined;
  takeover_not?: boolean | null | undefined;
  takeover_not_in?: Array<boolean> | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  totalPnl?: string | null | undefined;
  totalPnl_gt?: string | null | undefined;
  totalPnl_gte?: string | null | undefined;
  totalPnl_in?: Array<string> | null | undefined;
  totalPnl_lt?: string | null | undefined;
  totalPnl_lte?: string | null | undefined;
  totalPnl_not?: string | null | undefined;
  totalPnl_not_in?: Array<string> | null | undefined;
  totalUnrealizedLoss?: string | null | undefined;
  totalUnrealizedLoss_gt?: string | null | undefined;
  totalUnrealizedLoss_gte?: string | null | undefined;
  totalUnrealizedLoss_in?: Array<string> | null | undefined;
  totalUnrealizedLoss_lt?: string | null | undefined;
  totalUnrealizedLoss_lte?: string | null | undefined;
  totalUnrealizedLoss_not?: string | null | undefined;
  totalUnrealizedLoss_not_in?: Array<string> | null | undefined;
  upnl?: string | null | undefined;
  upnl_gt?: string | null | undefined;
  upnl_gte?: string | null | undefined;
  upnl_in?: Array<string> | null | undefined;
  upnl_lt?: string | null | undefined;
  upnl_lte?: string | null | undefined;
  upnl_not?: string | null | undefined;
  upnl_not_in?: Array<string> | null | undefined;
  virtualAccountRef?: string | null | undefined;
  virtualAccountRef_?: VirtualAccount_Filter | null | undefined;
  virtualAccountRef_contains?: string | null | undefined;
  virtualAccountRef_contains_nocase?: string | null | undefined;
  virtualAccountRef_ends_with?: string | null | undefined;
  virtualAccountRef_ends_with_nocase?: string | null | undefined;
  virtualAccountRef_gt?: string | null | undefined;
  virtualAccountRef_gte?: string | null | undefined;
  virtualAccountRef_in?: Array<string> | null | undefined;
  virtualAccountRef_lt?: string | null | undefined;
  virtualAccountRef_lte?: string | null | undefined;
  virtualAccountRef_not?: string | null | undefined;
  virtualAccountRef_not_contains?: string | null | undefined;
  virtualAccountRef_not_contains_nocase?: string | null | undefined;
  virtualAccountRef_not_ends_with?: string | null | undefined;
  virtualAccountRef_not_ends_with_nocase?: string | null | undefined;
  virtualAccountRef_not_in?: Array<string> | null | undefined;
  virtualAccountRef_not_starts_with?: string | null | undefined;
  virtualAccountRef_not_starts_with_nocase?: string | null | undefined;
  virtualAccountRef_starts_with?: string | null | undefined;
  virtualAccountRef_starts_with_nocase?: string | null | undefined;
};

export type LiquidationDetail_OrderBy =
  | "accountLayerSource"
  | "affiliate"
  | "allocatedBalance"
  | "autoTakeover"
  | "coreSource"
  | "deferredBalance"
  | "deficit"
  | "deploymentId"
  | "disputed"
  | "events"
  | "freeBalance"
  | "freeMarginAtStart"
  | "fullyLiquidated"
  | "fullyLiquidatedTimestamp"
  | "globalCounter"
  | "id"
  | "involvedPartyBCounts"
  | "liquidationAllocatedBalance"
  | "liquidationBlockNumber"
  | "liquidationEscrow"
  | "liquidationFee"
  | "liquidationId"
  | "liquidationStartTransaction"
  | "liquidationTimestamp"
  | "liquidationType"
  | "liquidator"
  | "lockedCva"
  | "lockedLf"
  | "lockedPartyAmm"
  | "lockedPartyBmm"
  | "lossRestsAt"
  | "owner"
  | "paidCva"
  | "paidLf"
  | "partyA"
  | "partyAAccount"
  | "partyAAccount__account"
  | "partyAAccount__accountKind"
  | "partyAAccount__accountLayerSource"
  | "partyAAccount__accountSource"
  | "partyAAccount__affiliate"
  | "partyAAccount__allocated"
  | "partyAAccount__blockNumber"
  | "partyAAccount__coreSource"
  | "partyAAccount__deallocated"
  | "partyAAccount__deploymentId"
  | "partyAAccount__deposit"
  | "partyAAccount__globalCounter"
  | "partyAAccount__id"
  | "partyAAccount__isDeleted"
  | "partyAAccount__isVirtual"
  | "partyAAccount__lastActivityTimestamp"
  | "partyAAccount__lastBalanceActivityTimestamp"
  | "partyAAccount__lastCoreActivityTimestamp"
  | "partyAAccount__lastLayerActivityTimestamp"
  | "partyAAccount__name"
  | "partyAAccount__owner"
  | "partyAAccount__parentAddress"
  | "partyAAccount__positionsCount"
  | "partyAAccount__quotesCount"
  | "partyAAccount__source"
  | "partyAAccount__timestamp"
  | "partyAAccount__transaction"
  | "partyAAccount__type"
  | "partyAAccount__updateTimestamp"
  | "partyAAccount__user"
  | "partyAAccount__withdraw"
  | "partyAAccumulatedUpnl"
  | "potentialLf"
  | "reimbursement"
  | "settled"
  | "settledAmounts"
  | "settledPartyBs"
  | "settlementActualAmounts"
  | "settlementAttributionComplete"
  | "settlementCvaReturned"
  | "settlementExpectedAmounts"
  | "settlementModes"
  | "settlementPartyBs"
  | "settlementReserveContributions"
  | "settlementStates"
  | "source"
  | "subAccountRef"
  | "subAccountRef__accountLayerSource"
  | "subAccountRef__activePositions"
  | "subAccountRef__activeVirtualAccounts"
  | "subAccountRef__address"
  | "subAccountRef__affiliateAddress"
  | "subAccountRef__cancelledQuotesCount"
  | "subAccountRef__closedQuotesCount"
  | "subAccountRef__coreSource"
  | "subAccountRef__deploymentId"
  | "subAccountRef__expiredQuotesCount"
  | "subAccountRef__id"
  | "subAccountRef__isDeleted"
  | "subAccountRef__isLegacy"
  | "subAccountRef__isolationType"
  | "subAccountRef__lastConfigTimestamp"
  | "subAccountRef__lastMarginTransferTimestamp"
  | "subAccountRef__lastTradeTimestamp"
  | "subAccountRef__latestMarginBalance"
  | "subAccountRef__legacyContract"
  | "subAccountRef__legacyImported"
  | "subAccountRef__legacyImportedTimestamp"
  | "subAccountRef__liquidatedQuotesCount"
  | "subAccountRef__metadata"
  | "subAccountRef__name"
  | "subAccountRef__openPositionsCount"
  | "subAccountRef__owner"
  | "subAccountRef__pendingQuotesCount"
  | "subAccountRef__rejectedQuotesCount"
  | "subAccountRef__routingMode"
  | "subAccountRef__singleVAMode"
  | "subAccountRef__source"
  | "subAccountRef__symmioCore"
  | "subAccountRef__timestamp"
  | "subAccountRef__totalPositions"
  | "subAccountRef__totalVirtualAccounts"
  | "subAccountRef__updateTimestamp"
  | "takeover"
  | "takeoverSettled"
  | "takeoverSettledTimestamp"
  | "takeoverTimestamp"
  | "timestamp"
  | "totalPnl"
  | "totalUnrealizedLoss"
  | "upnl"
  | "virtualAccountRef"
  | "virtualAccountRef__accountLayerSource"
  | "virtualAccountRef__activePositions"
  | "virtualAccountRef__address"
  | "virtualAccountRef__cancelledQuotesCount"
  | "virtualAccountRef__closedQuotesCount"
  | "virtualAccountRef__coreSource"
  | "virtualAccountRef__deploymentId"
  | "virtualAccountRef__expiredQuotesCount"
  | "virtualAccountRef__id"
  | "virtualAccountRef__isDeleted"
  | "virtualAccountRef__isolationType"
  | "virtualAccountRef__lastDeleteTimestamp"
  | "virtualAccountRef__lastMarginTransferTimestamp"
  | "virtualAccountRef__lastReuseTimestamp"
  | "virtualAccountRef__lastTradeTimestamp"
  | "virtualAccountRef__latestMarginBalance"
  | "virtualAccountRef__liquidatedQuotesCount"
  | "virtualAccountRef__metadata"
  | "virtualAccountRef__openPositionsCount"
  | "virtualAccountRef__owner"
  | "virtualAccountRef__parentAddress"
  | "virtualAccountRef__pendingQuotesCount"
  | "virtualAccountRef__rejectedQuotesCount"
  | "virtualAccountRef__reuseCount"
  | "virtualAccountRef__source"
  | "virtualAccountRef__symbolId"
  | "virtualAccountRef__timestamp"
  | "virtualAccountRef__totalPositions"
  | "virtualAccountRef__updateTimestamp";

export type LiquidationEvent_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  and?: Array<LiquidationEvent_Filter | null | undefined> | null | undefined;
  blockNumber?: string | null | undefined;
  blockNumber_gt?: string | null | undefined;
  blockNumber_gte?: string | null | undefined;
  blockNumber_in?: Array<string> | null | undefined;
  blockNumber_lt?: string | null | undefined;
  blockNumber_lte?: string | null | undefined;
  blockNumber_not?: string | null | undefined;
  blockNumber_not_in?: Array<string> | null | undefined;
  globalCounter?: string | null | undefined;
  globalCounter_gt?: string | null | undefined;
  globalCounter_gte?: string | null | undefined;
  globalCounter_in?: Array<string> | null | undefined;
  globalCounter_lt?: string | null | undefined;
  globalCounter_lte?: string | null | undefined;
  globalCounter_not?: string | null | undefined;
  globalCounter_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  liquidationDetail?: string | null | undefined;
  liquidationDetail_?: LiquidationDetail_Filter | null | undefined;
  liquidationDetail_contains?: string | null | undefined;
  liquidationDetail_contains_nocase?: string | null | undefined;
  liquidationDetail_ends_with?: string | null | undefined;
  liquidationDetail_ends_with_nocase?: string | null | undefined;
  liquidationDetail_gt?: string | null | undefined;
  liquidationDetail_gte?: string | null | undefined;
  liquidationDetail_in?: Array<string> | null | undefined;
  liquidationDetail_lt?: string | null | undefined;
  liquidationDetail_lte?: string | null | undefined;
  liquidationDetail_not?: string | null | undefined;
  liquidationDetail_not_contains?: string | null | undefined;
  liquidationDetail_not_contains_nocase?: string | null | undefined;
  liquidationDetail_not_ends_with?: string | null | undefined;
  liquidationDetail_not_ends_with_nocase?: string | null | undefined;
  liquidationDetail_not_in?: Array<string> | null | undefined;
  liquidationDetail_not_starts_with?: string | null | undefined;
  liquidationDetail_not_starts_with_nocase?: string | null | undefined;
  liquidationDetail_starts_with?: string | null | undefined;
  liquidationDetail_starts_with_nocase?: string | null | undefined;
  liquidationId?: string | null | undefined;
  liquidationId_contains?: string | null | undefined;
  liquidationId_gt?: string | null | undefined;
  liquidationId_gte?: string | null | undefined;
  liquidationId_in?: Array<string> | null | undefined;
  liquidationId_lt?: string | null | undefined;
  liquidationId_lte?: string | null | undefined;
  liquidationId_not?: string | null | undefined;
  liquidationId_not_contains?: string | null | undefined;
  liquidationId_not_in?: Array<string> | null | undefined;
  liquidator?: string | null | undefined;
  liquidator_contains?: string | null | undefined;
  liquidator_gt?: string | null | undefined;
  liquidator_gte?: string | null | undefined;
  liquidator_in?: Array<string> | null | undefined;
  liquidator_lt?: string | null | undefined;
  liquidator_lte?: string | null | undefined;
  liquidator_not?: string | null | undefined;
  liquidator_not_contains?: string | null | undefined;
  liquidator_not_in?: Array<string> | null | undefined;
  metadata?: string | null | undefined;
  metadata_contains?: string | null | undefined;
  metadata_contains_nocase?: string | null | undefined;
  metadata_ends_with?: string | null | undefined;
  metadata_ends_with_nocase?: string | null | undefined;
  metadata_gt?: string | null | undefined;
  metadata_gte?: string | null | undefined;
  metadata_in?: Array<string> | null | undefined;
  metadata_lt?: string | null | undefined;
  metadata_lte?: string | null | undefined;
  metadata_not?: string | null | undefined;
  metadata_not_contains?: string | null | undefined;
  metadata_not_contains_nocase?: string | null | undefined;
  metadata_not_ends_with?: string | null | undefined;
  metadata_not_ends_with_nocase?: string | null | undefined;
  metadata_not_in?: Array<string> | null | undefined;
  metadata_not_starts_with?: string | null | undefined;
  metadata_not_starts_with_nocase?: string | null | undefined;
  metadata_starts_with?: string | null | undefined;
  metadata_starts_with_nocase?: string | null | undefined;
  or?: Array<LiquidationEvent_Filter | null | undefined> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  transaction?: string | null | undefined;
  transaction_contains?: string | null | undefined;
  transaction_gt?: string | null | undefined;
  transaction_gte?: string | null | undefined;
  transaction_in?: Array<string> | null | undefined;
  transaction_lt?: string | null | undefined;
  transaction_lte?: string | null | undefined;
  transaction_not?: string | null | undefined;
  transaction_not_contains?: string | null | undefined;
  transaction_not_in?: Array<string> | null | undefined;
  type?: string | null | undefined;
  type_contains?: string | null | undefined;
  type_contains_nocase?: string | null | undefined;
  type_ends_with?: string | null | undefined;
  type_ends_with_nocase?: string | null | undefined;
  type_gt?: string | null | undefined;
  type_gte?: string | null | undefined;
  type_in?: Array<string> | null | undefined;
  type_lt?: string | null | undefined;
  type_lte?: string | null | undefined;
  type_not?: string | null | undefined;
  type_not_contains?: string | null | undefined;
  type_not_contains_nocase?: string | null | undefined;
  type_not_ends_with?: string | null | undefined;
  type_not_ends_with_nocase?: string | null | undefined;
  type_not_in?: Array<string> | null | undefined;
  type_not_starts_with?: string | null | undefined;
  type_not_starts_with_nocase?: string | null | undefined;
  type_starts_with?: string | null | undefined;
  type_starts_with_nocase?: string | null | undefined;
};

export type MarginTransfer_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  accountLayerSource?: string | null | undefined;
  accountLayerSource_contains?: string | null | undefined;
  accountLayerSource_gt?: string | null | undefined;
  accountLayerSource_gte?: string | null | undefined;
  accountLayerSource_in?: Array<string> | null | undefined;
  accountLayerSource_lt?: string | null | undefined;
  accountLayerSource_lte?: string | null | undefined;
  accountLayerSource_not?: string | null | undefined;
  accountLayerSource_not_contains?: string | null | undefined;
  accountLayerSource_not_in?: Array<string> | null | undefined;
  amount?: string | null | undefined;
  amount_gt?: string | null | undefined;
  amount_gte?: string | null | undefined;
  amount_in?: Array<string> | null | undefined;
  amount_lt?: string | null | undefined;
  amount_lte?: string | null | undefined;
  amount_not?: string | null | undefined;
  amount_not_in?: Array<string> | null | undefined;
  and?: Array<MarginTransfer_Filter | null | undefined> | null | undefined;
  blockNumber?: string | null | undefined;
  blockNumber_gt?: string | null | undefined;
  blockNumber_gte?: string | null | undefined;
  blockNumber_in?: Array<string> | null | undefined;
  blockNumber_lt?: string | null | undefined;
  blockNumber_lte?: string | null | undefined;
  blockNumber_not?: string | null | undefined;
  blockNumber_not_in?: Array<string> | null | undefined;
  coreSource?: string | null | undefined;
  coreSource_contains?: string | null | undefined;
  coreSource_gt?: string | null | undefined;
  coreSource_gte?: string | null | undefined;
  coreSource_in?: Array<string> | null | undefined;
  coreSource_lt?: string | null | undefined;
  coreSource_lte?: string | null | undefined;
  coreSource_not?: string | null | undefined;
  coreSource_not_contains?: string | null | undefined;
  coreSource_not_in?: Array<string> | null | undefined;
  deploymentId?: string | null | undefined;
  deploymentId_contains?: string | null | undefined;
  deploymentId_contains_nocase?: string | null | undefined;
  deploymentId_ends_with?: string | null | undefined;
  deploymentId_ends_with_nocase?: string | null | undefined;
  deploymentId_gt?: string | null | undefined;
  deploymentId_gte?: string | null | undefined;
  deploymentId_in?: Array<string> | null | undefined;
  deploymentId_lt?: string | null | undefined;
  deploymentId_lte?: string | null | undefined;
  deploymentId_not?: string | null | undefined;
  deploymentId_not_contains?: string | null | undefined;
  deploymentId_not_contains_nocase?: string | null | undefined;
  deploymentId_not_ends_with?: string | null | undefined;
  deploymentId_not_ends_with_nocase?: string | null | undefined;
  deploymentId_not_in?: Array<string> | null | undefined;
  deploymentId_not_starts_with?: string | null | undefined;
  deploymentId_not_starts_with_nocase?: string | null | undefined;
  deploymentId_starts_with?: string | null | undefined;
  deploymentId_starts_with_nocase?: string | null | undefined;
  globalCounter?: string | null | undefined;
  globalCounter_gt?: string | null | undefined;
  globalCounter_gte?: string | null | undefined;
  globalCounter_in?: Array<string> | null | undefined;
  globalCounter_lt?: string | null | undefined;
  globalCounter_lte?: string | null | undefined;
  globalCounter_not?: string | null | undefined;
  globalCounter_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  or?: Array<MarginTransfer_Filter | null | undefined> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  subAccount?: string | null | undefined;
  subAccountRef?: string | null | undefined;
  subAccountRef_?: SubAccount_Filter | null | undefined;
  subAccountRef_contains?: string | null | undefined;
  subAccountRef_contains_nocase?: string | null | undefined;
  subAccountRef_ends_with?: string | null | undefined;
  subAccountRef_ends_with_nocase?: string | null | undefined;
  subAccountRef_gt?: string | null | undefined;
  subAccountRef_gte?: string | null | undefined;
  subAccountRef_in?: Array<string> | null | undefined;
  subAccountRef_lt?: string | null | undefined;
  subAccountRef_lte?: string | null | undefined;
  subAccountRef_not?: string | null | undefined;
  subAccountRef_not_contains?: string | null | undefined;
  subAccountRef_not_contains_nocase?: string | null | undefined;
  subAccountRef_not_ends_with?: string | null | undefined;
  subAccountRef_not_ends_with_nocase?: string | null | undefined;
  subAccountRef_not_in?: Array<string> | null | undefined;
  subAccountRef_not_starts_with?: string | null | undefined;
  subAccountRef_not_starts_with_nocase?: string | null | undefined;
  subAccountRef_starts_with?: string | null | undefined;
  subAccountRef_starts_with_nocase?: string | null | undefined;
  subAccount_?: SubAccount_Filter | null | undefined;
  subAccount_contains?: string | null | undefined;
  subAccount_contains_nocase?: string | null | undefined;
  subAccount_ends_with?: string | null | undefined;
  subAccount_ends_with_nocase?: string | null | undefined;
  subAccount_gt?: string | null | undefined;
  subAccount_gte?: string | null | undefined;
  subAccount_in?: Array<string> | null | undefined;
  subAccount_lt?: string | null | undefined;
  subAccount_lte?: string | null | undefined;
  subAccount_not?: string | null | undefined;
  subAccount_not_contains?: string | null | undefined;
  subAccount_not_contains_nocase?: string | null | undefined;
  subAccount_not_ends_with?: string | null | undefined;
  subAccount_not_ends_with_nocase?: string | null | undefined;
  subAccount_not_in?: Array<string> | null | undefined;
  subAccount_not_starts_with?: string | null | undefined;
  subAccount_not_starts_with_nocase?: string | null | undefined;
  subAccount_starts_with?: string | null | undefined;
  subAccount_starts_with_nocase?: string | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  transaction?: string | null | undefined;
  transaction_contains?: string | null | undefined;
  transaction_gt?: string | null | undefined;
  transaction_gte?: string | null | undefined;
  transaction_in?: Array<string> | null | undefined;
  transaction_lt?: string | null | undefined;
  transaction_lte?: string | null | undefined;
  transaction_not?: string | null | undefined;
  transaction_not_contains?: string | null | undefined;
  transaction_not_in?: Array<string> | null | undefined;
  type?: string | null | undefined;
  type_contains?: string | null | undefined;
  type_contains_nocase?: string | null | undefined;
  type_ends_with?: string | null | undefined;
  type_ends_with_nocase?: string | null | undefined;
  type_gt?: string | null | undefined;
  type_gte?: string | null | undefined;
  type_in?: Array<string> | null | undefined;
  type_lt?: string | null | undefined;
  type_lte?: string | null | undefined;
  type_not?: string | null | undefined;
  type_not_contains?: string | null | undefined;
  type_not_contains_nocase?: string | null | undefined;
  type_not_ends_with?: string | null | undefined;
  type_not_ends_with_nocase?: string | null | undefined;
  type_not_in?: Array<string> | null | undefined;
  type_not_starts_with?: string | null | undefined;
  type_not_starts_with_nocase?: string | null | undefined;
  type_starts_with?: string | null | undefined;
  type_starts_with_nocase?: string | null | undefined;
  virtualAccount?: string | null | undefined;
  virtualAccountRef?: string | null | undefined;
  virtualAccountRef_?: VirtualAccount_Filter | null | undefined;
  virtualAccountRef_contains?: string | null | undefined;
  virtualAccountRef_contains_nocase?: string | null | undefined;
  virtualAccountRef_ends_with?: string | null | undefined;
  virtualAccountRef_ends_with_nocase?: string | null | undefined;
  virtualAccountRef_gt?: string | null | undefined;
  virtualAccountRef_gte?: string | null | undefined;
  virtualAccountRef_in?: Array<string> | null | undefined;
  virtualAccountRef_lt?: string | null | undefined;
  virtualAccountRef_lte?: string | null | undefined;
  virtualAccountRef_not?: string | null | undefined;
  virtualAccountRef_not_contains?: string | null | undefined;
  virtualAccountRef_not_contains_nocase?: string | null | undefined;
  virtualAccountRef_not_ends_with?: string | null | undefined;
  virtualAccountRef_not_ends_with_nocase?: string | null | undefined;
  virtualAccountRef_not_in?: Array<string> | null | undefined;
  virtualAccountRef_not_starts_with?: string | null | undefined;
  virtualAccountRef_not_starts_with_nocase?: string | null | undefined;
  virtualAccountRef_starts_with?: string | null | undefined;
  virtualAccountRef_starts_with_nocase?: string | null | undefined;
  virtualAccount_?: VirtualAccount_Filter | null | undefined;
  virtualAccount_contains?: string | null | undefined;
  virtualAccount_contains_nocase?: string | null | undefined;
  virtualAccount_ends_with?: string | null | undefined;
  virtualAccount_ends_with_nocase?: string | null | undefined;
  virtualAccount_gt?: string | null | undefined;
  virtualAccount_gte?: string | null | undefined;
  virtualAccount_in?: Array<string> | null | undefined;
  virtualAccount_lt?: string | null | undefined;
  virtualAccount_lte?: string | null | undefined;
  virtualAccount_not?: string | null | undefined;
  virtualAccount_not_contains?: string | null | undefined;
  virtualAccount_not_contains_nocase?: string | null | undefined;
  virtualAccount_not_ends_with?: string | null | undefined;
  virtualAccount_not_ends_with_nocase?: string | null | undefined;
  virtualAccount_not_in?: Array<string> | null | undefined;
  virtualAccount_not_starts_with?: string | null | undefined;
  virtualAccount_not_starts_with_nocase?: string | null | undefined;
  virtualAccount_starts_with?: string | null | undefined;
  virtualAccount_starts_with_nocase?: string | null | undefined;
};

export type MarginTransfer_OrderBy =
  | "accountLayerSource"
  | "amount"
  | "blockNumber"
  | "coreSource"
  | "deploymentId"
  | "globalCounter"
  | "id"
  | "source"
  | "subAccount"
  | "subAccountRef"
  | "subAccountRef__accountLayerSource"
  | "subAccountRef__activePositions"
  | "subAccountRef__activeVirtualAccounts"
  | "subAccountRef__address"
  | "subAccountRef__affiliateAddress"
  | "subAccountRef__cancelledQuotesCount"
  | "subAccountRef__closedQuotesCount"
  | "subAccountRef__coreSource"
  | "subAccountRef__deploymentId"
  | "subAccountRef__expiredQuotesCount"
  | "subAccountRef__id"
  | "subAccountRef__isDeleted"
  | "subAccountRef__isLegacy"
  | "subAccountRef__isolationType"
  | "subAccountRef__lastConfigTimestamp"
  | "subAccountRef__lastMarginTransferTimestamp"
  | "subAccountRef__lastTradeTimestamp"
  | "subAccountRef__latestMarginBalance"
  | "subAccountRef__legacyContract"
  | "subAccountRef__legacyImported"
  | "subAccountRef__legacyImportedTimestamp"
  | "subAccountRef__liquidatedQuotesCount"
  | "subAccountRef__metadata"
  | "subAccountRef__name"
  | "subAccountRef__openPositionsCount"
  | "subAccountRef__owner"
  | "subAccountRef__pendingQuotesCount"
  | "subAccountRef__rejectedQuotesCount"
  | "subAccountRef__routingMode"
  | "subAccountRef__singleVAMode"
  | "subAccountRef__source"
  | "subAccountRef__symmioCore"
  | "subAccountRef__timestamp"
  | "subAccountRef__totalPositions"
  | "subAccountRef__totalVirtualAccounts"
  | "subAccountRef__updateTimestamp"
  | "subAccount__accountLayerSource"
  | "subAccount__activePositions"
  | "subAccount__activeVirtualAccounts"
  | "subAccount__address"
  | "subAccount__affiliateAddress"
  | "subAccount__cancelledQuotesCount"
  | "subAccount__closedQuotesCount"
  | "subAccount__coreSource"
  | "subAccount__deploymentId"
  | "subAccount__expiredQuotesCount"
  | "subAccount__id"
  | "subAccount__isDeleted"
  | "subAccount__isLegacy"
  | "subAccount__isolationType"
  | "subAccount__lastConfigTimestamp"
  | "subAccount__lastMarginTransferTimestamp"
  | "subAccount__lastTradeTimestamp"
  | "subAccount__latestMarginBalance"
  | "subAccount__legacyContract"
  | "subAccount__legacyImported"
  | "subAccount__legacyImportedTimestamp"
  | "subAccount__liquidatedQuotesCount"
  | "subAccount__metadata"
  | "subAccount__name"
  | "subAccount__openPositionsCount"
  | "subAccount__owner"
  | "subAccount__pendingQuotesCount"
  | "subAccount__rejectedQuotesCount"
  | "subAccount__routingMode"
  | "subAccount__singleVAMode"
  | "subAccount__source"
  | "subAccount__symmioCore"
  | "subAccount__timestamp"
  | "subAccount__totalPositions"
  | "subAccount__totalVirtualAccounts"
  | "subAccount__updateTimestamp"
  | "timestamp"
  | "transaction"
  | "type"
  | "virtualAccount"
  | "virtualAccountRef"
  | "virtualAccountRef__accountLayerSource"
  | "virtualAccountRef__activePositions"
  | "virtualAccountRef__address"
  | "virtualAccountRef__cancelledQuotesCount"
  | "virtualAccountRef__closedQuotesCount"
  | "virtualAccountRef__coreSource"
  | "virtualAccountRef__deploymentId"
  | "virtualAccountRef__expiredQuotesCount"
  | "virtualAccountRef__id"
  | "virtualAccountRef__isDeleted"
  | "virtualAccountRef__isolationType"
  | "virtualAccountRef__lastDeleteTimestamp"
  | "virtualAccountRef__lastMarginTransferTimestamp"
  | "virtualAccountRef__lastReuseTimestamp"
  | "virtualAccountRef__lastTradeTimestamp"
  | "virtualAccountRef__latestMarginBalance"
  | "virtualAccountRef__liquidatedQuotesCount"
  | "virtualAccountRef__metadata"
  | "virtualAccountRef__openPositionsCount"
  | "virtualAccountRef__owner"
  | "virtualAccountRef__parentAddress"
  | "virtualAccountRef__pendingQuotesCount"
  | "virtualAccountRef__rejectedQuotesCount"
  | "virtualAccountRef__reuseCount"
  | "virtualAccountRef__source"
  | "virtualAccountRef__symbolId"
  | "virtualAccountRef__timestamp"
  | "virtualAccountRef__totalPositions"
  | "virtualAccountRef__updateTimestamp"
  | "virtualAccount__accountLayerSource"
  | "virtualAccount__activePositions"
  | "virtualAccount__address"
  | "virtualAccount__cancelledQuotesCount"
  | "virtualAccount__closedQuotesCount"
  | "virtualAccount__coreSource"
  | "virtualAccount__deploymentId"
  | "virtualAccount__expiredQuotesCount"
  | "virtualAccount__id"
  | "virtualAccount__isDeleted"
  | "virtualAccount__isolationType"
  | "virtualAccount__lastDeleteTimestamp"
  | "virtualAccount__lastMarginTransferTimestamp"
  | "virtualAccount__lastReuseTimestamp"
  | "virtualAccount__lastTradeTimestamp"
  | "virtualAccount__latestMarginBalance"
  | "virtualAccount__liquidatedQuotesCount"
  | "virtualAccount__metadata"
  | "virtualAccount__openPositionsCount"
  | "virtualAccount__owner"
  | "virtualAccount__parentAddress"
  | "virtualAccount__pendingQuotesCount"
  | "virtualAccount__rejectedQuotesCount"
  | "virtualAccount__reuseCount"
  | "virtualAccount__source"
  | "virtualAccount__symbolId"
  | "virtualAccount__timestamp"
  | "virtualAccount__totalPositions"
  | "virtualAccount__updateTimestamp";

/** Defines the order direction, either ascending or descending */
export type OrderDirection = "asc" | "desc";

export type QuoteEvent_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  and?: Array<QuoteEvent_Filter | null | undefined> | null | undefined;
  blockNumber?: string | null | undefined;
  blockNumber_gt?: string | null | undefined;
  blockNumber_gte?: string | null | undefined;
  blockNumber_in?: Array<string> | null | undefined;
  blockNumber_lt?: string | null | undefined;
  blockNumber_lte?: string | null | undefined;
  blockNumber_not?: string | null | undefined;
  blockNumber_not_in?: Array<string> | null | undefined;
  globalCounter?: string | null | undefined;
  globalCounter_gt?: string | null | undefined;
  globalCounter_gte?: string | null | undefined;
  globalCounter_in?: Array<string> | null | undefined;
  globalCounter_lt?: string | null | undefined;
  globalCounter_lte?: string | null | undefined;
  globalCounter_not?: string | null | undefined;
  globalCounter_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  metadata?: string | null | undefined;
  metadata_contains?: string | null | undefined;
  metadata_contains_nocase?: string | null | undefined;
  metadata_ends_with?: string | null | undefined;
  metadata_ends_with_nocase?: string | null | undefined;
  metadata_gt?: string | null | undefined;
  metadata_gte?: string | null | undefined;
  metadata_in?: Array<string> | null | undefined;
  metadata_lt?: string | null | undefined;
  metadata_lte?: string | null | undefined;
  metadata_not?: string | null | undefined;
  metadata_not_contains?: string | null | undefined;
  metadata_not_contains_nocase?: string | null | undefined;
  metadata_not_ends_with?: string | null | undefined;
  metadata_not_ends_with_nocase?: string | null | undefined;
  metadata_not_in?: Array<string> | null | undefined;
  metadata_not_starts_with?: string | null | undefined;
  metadata_not_starts_with_nocase?: string | null | undefined;
  metadata_starts_with?: string | null | undefined;
  metadata_starts_with_nocase?: string | null | undefined;
  or?: Array<QuoteEvent_Filter | null | undefined> | null | undefined;
  quote?: string | null | undefined;
  quoteId?: string | null | undefined;
  quoteId_gt?: string | null | undefined;
  quoteId_gte?: string | null | undefined;
  quoteId_in?: Array<string> | null | undefined;
  quoteId_lt?: string | null | undefined;
  quoteId_lte?: string | null | undefined;
  quoteId_not?: string | null | undefined;
  quoteId_not_in?: Array<string> | null | undefined;
  quote_?: Quote_Filter | null | undefined;
  quote_contains?: string | null | undefined;
  quote_contains_nocase?: string | null | undefined;
  quote_ends_with?: string | null | undefined;
  quote_ends_with_nocase?: string | null | undefined;
  quote_gt?: string | null | undefined;
  quote_gte?: string | null | undefined;
  quote_in?: Array<string> | null | undefined;
  quote_lt?: string | null | undefined;
  quote_lte?: string | null | undefined;
  quote_not?: string | null | undefined;
  quote_not_contains?: string | null | undefined;
  quote_not_contains_nocase?: string | null | undefined;
  quote_not_ends_with?: string | null | undefined;
  quote_not_ends_with_nocase?: string | null | undefined;
  quote_not_in?: Array<string> | null | undefined;
  quote_not_starts_with?: string | null | undefined;
  quote_not_starts_with_nocase?: string | null | undefined;
  quote_starts_with?: string | null | undefined;
  quote_starts_with_nocase?: string | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  transaction?: string | null | undefined;
  transaction_contains?: string | null | undefined;
  transaction_gt?: string | null | undefined;
  transaction_gte?: string | null | undefined;
  transaction_in?: Array<string> | null | undefined;
  transaction_lt?: string | null | undefined;
  transaction_lte?: string | null | undefined;
  transaction_not?: string | null | undefined;
  transaction_not_contains?: string | null | undefined;
  transaction_not_in?: Array<string> | null | undefined;
  type?: string | null | undefined;
  type_contains?: string | null | undefined;
  type_contains_nocase?: string | null | undefined;
  type_ends_with?: string | null | undefined;
  type_ends_with_nocase?: string | null | undefined;
  type_gt?: string | null | undefined;
  type_gte?: string | null | undefined;
  type_in?: Array<string> | null | undefined;
  type_lt?: string | null | undefined;
  type_lte?: string | null | undefined;
  type_not?: string | null | undefined;
  type_not_contains?: string | null | undefined;
  type_not_contains_nocase?: string | null | undefined;
  type_not_ends_with?: string | null | undefined;
  type_not_ends_with_nocase?: string | null | undefined;
  type_not_in?: Array<string> | null | undefined;
  type_not_starts_with?: string | null | undefined;
  type_not_starts_with_nocase?: string | null | undefined;
  type_starts_with?: string | null | undefined;
  type_starts_with_nocase?: string | null | undefined;
};

export type QuoteFundingSettlement_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  and?: Array<QuoteFundingSettlement_Filter | null | undefined> | null | undefined;
  balanceChanged?: boolean | null | undefined;
  balanceChanged_in?: Array<boolean> | null | undefined;
  balanceChanged_not?: boolean | null | undefined;
  balanceChanged_not_in?: Array<boolean> | null | undefined;
  blockNumber?: string | null | undefined;
  blockNumber_gt?: string | null | undefined;
  blockNumber_gte?: string | null | undefined;
  blockNumber_in?: Array<string> | null | undefined;
  blockNumber_lt?: string | null | undefined;
  blockNumber_lte?: string | null | undefined;
  blockNumber_not?: string | null | undefined;
  blockNumber_not_in?: Array<string> | null | undefined;
  fundingDeltaPerUnit?: string | null | undefined;
  fundingDeltaPerUnit_gt?: string | null | undefined;
  fundingDeltaPerUnit_gte?: string | null | undefined;
  fundingDeltaPerUnit_in?: Array<string> | null | undefined;
  fundingDeltaPerUnit_lt?: string | null | undefined;
  fundingDeltaPerUnit_lte?: string | null | undefined;
  fundingDeltaPerUnit_not?: string | null | undefined;
  fundingDeltaPerUnit_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  newAccumulatedPaidFunding?: string | null | undefined;
  newAccumulatedPaidFunding_gt?: string | null | undefined;
  newAccumulatedPaidFunding_gte?: string | null | undefined;
  newAccumulatedPaidFunding_in?: Array<string> | null | undefined;
  newAccumulatedPaidFunding_lt?: string | null | undefined;
  newAccumulatedPaidFunding_lte?: string | null | undefined;
  newAccumulatedPaidFunding_not?: string | null | undefined;
  newAccumulatedPaidFunding_not_in?: Array<string> | null | undefined;
  newLastFundingPaymentTimestamp?: string | null | undefined;
  newLastFundingPaymentTimestamp_gt?: string | null | undefined;
  newLastFundingPaymentTimestamp_gte?: string | null | undefined;
  newLastFundingPaymentTimestamp_in?: Array<string> | null | undefined;
  newLastFundingPaymentTimestamp_lt?: string | null | undefined;
  newLastFundingPaymentTimestamp_lte?: string | null | undefined;
  newLastFundingPaymentTimestamp_not?: string | null | undefined;
  newLastFundingPaymentTimestamp_not_in?: Array<string> | null | undefined;
  newPaidThroughEpoch?: string | null | undefined;
  newPaidThroughEpoch_gt?: string | null | undefined;
  newPaidThroughEpoch_gte?: string | null | undefined;
  newPaidThroughEpoch_in?: Array<string> | null | undefined;
  newPaidThroughEpoch_lt?: string | null | undefined;
  newPaidThroughEpoch_lte?: string | null | undefined;
  newPaidThroughEpoch_not?: string | null | undefined;
  newPaidThroughEpoch_not_in?: Array<string> | null | undefined;
  openAmount?: string | null | undefined;
  openAmount_gt?: string | null | undefined;
  openAmount_gte?: string | null | undefined;
  openAmount_in?: Array<string> | null | undefined;
  openAmount_lt?: string | null | undefined;
  openAmount_lte?: string | null | undefined;
  openAmount_not?: string | null | undefined;
  openAmount_not_in?: Array<string> | null | undefined;
  or?: Array<QuoteFundingSettlement_Filter | null | undefined> | null | undefined;
  paidByPartyA?: string | null | undefined;
  paidByPartyA_gt?: string | null | undefined;
  paidByPartyA_gte?: string | null | undefined;
  paidByPartyA_in?: Array<string> | null | undefined;
  paidByPartyA_lt?: string | null | undefined;
  paidByPartyA_lte?: string | null | undefined;
  paidByPartyA_not?: string | null | undefined;
  paidByPartyA_not_in?: Array<string> | null | undefined;
  partyA?: string | null | undefined;
  partyA_contains?: string | null | undefined;
  partyA_gt?: string | null | undefined;
  partyA_gte?: string | null | undefined;
  partyA_in?: Array<string> | null | undefined;
  partyA_lt?: string | null | undefined;
  partyA_lte?: string | null | undefined;
  partyA_not?: string | null | undefined;
  partyA_not_contains?: string | null | undefined;
  partyA_not_in?: Array<string> | null | undefined;
  partyB?: string | null | undefined;
  partyB_contains?: string | null | undefined;
  partyB_gt?: string | null | undefined;
  partyB_gte?: string | null | undefined;
  partyB_in?: Array<string> | null | undefined;
  partyB_lt?: string | null | undefined;
  partyB_lte?: string | null | undefined;
  partyB_not?: string | null | undefined;
  partyB_not_contains?: string | null | undefined;
  partyB_not_in?: Array<string> | null | undefined;
  positionType?: number | null | undefined;
  positionType_gt?: number | null | undefined;
  positionType_gte?: number | null | undefined;
  positionType_in?: Array<number> | null | undefined;
  positionType_lt?: number | null | undefined;
  positionType_lte?: number | null | undefined;
  positionType_not?: number | null | undefined;
  positionType_not_in?: Array<number> | null | undefined;
  previousAccumulatedPaidFunding?: string | null | undefined;
  previousAccumulatedPaidFunding_gt?: string | null | undefined;
  previousAccumulatedPaidFunding_gte?: string | null | undefined;
  previousAccumulatedPaidFunding_in?: Array<string> | null | undefined;
  previousAccumulatedPaidFunding_lt?: string | null | undefined;
  previousAccumulatedPaidFunding_lte?: string | null | undefined;
  previousAccumulatedPaidFunding_not?: string | null | undefined;
  previousAccumulatedPaidFunding_not_in?: Array<string> | null | undefined;
  previousLastFundingPaymentTimestamp?: string | null | undefined;
  previousLastFundingPaymentTimestamp_gt?: string | null | undefined;
  previousLastFundingPaymentTimestamp_gte?: string | null | undefined;
  previousLastFundingPaymentTimestamp_in?: Array<string> | null | undefined;
  previousLastFundingPaymentTimestamp_lt?: string | null | undefined;
  previousLastFundingPaymentTimestamp_lte?: string | null | undefined;
  previousLastFundingPaymentTimestamp_not?: string | null | undefined;
  previousLastFundingPaymentTimestamp_not_in?: Array<string> | null | undefined;
  previousPaidThroughEpoch?: string | null | undefined;
  previousPaidThroughEpoch_gt?: string | null | undefined;
  previousPaidThroughEpoch_gte?: string | null | undefined;
  previousPaidThroughEpoch_in?: Array<string> | null | undefined;
  previousPaidThroughEpoch_lt?: string | null | undefined;
  previousPaidThroughEpoch_lte?: string | null | undefined;
  previousPaidThroughEpoch_not?: string | null | undefined;
  previousPaidThroughEpoch_not_in?: Array<string> | null | undefined;
  quote?: string | null | undefined;
  quoteId?: string | null | undefined;
  quoteId_gt?: string | null | undefined;
  quoteId_gte?: string | null | undefined;
  quoteId_in?: Array<string> | null | undefined;
  quoteId_lt?: string | null | undefined;
  quoteId_lte?: string | null | undefined;
  quoteId_not?: string | null | undefined;
  quoteId_not_in?: Array<string> | null | undefined;
  quote_?: Quote_Filter | null | undefined;
  quote_contains?: string | null | undefined;
  quote_contains_nocase?: string | null | undefined;
  quote_ends_with?: string | null | undefined;
  quote_ends_with_nocase?: string | null | undefined;
  quote_gt?: string | null | undefined;
  quote_gte?: string | null | undefined;
  quote_in?: Array<string> | null | undefined;
  quote_lt?: string | null | undefined;
  quote_lte?: string | null | undefined;
  quote_not?: string | null | undefined;
  quote_not_contains?: string | null | undefined;
  quote_not_contains_nocase?: string | null | undefined;
  quote_not_ends_with?: string | null | undefined;
  quote_not_ends_with_nocase?: string | null | undefined;
  quote_not_in?: Array<string> | null | undefined;
  quote_not_starts_with?: string | null | undefined;
  quote_not_starts_with_nocase?: string | null | undefined;
  quote_starts_with?: string | null | undefined;
  quote_starts_with_nocase?: string | null | undefined;
  receivedByPartyA?: string | null | undefined;
  receivedByPartyA_gt?: string | null | undefined;
  receivedByPartyA_gte?: string | null | undefined;
  receivedByPartyA_in?: Array<string> | null | undefined;
  receivedByPartyA_lt?: string | null | undefined;
  receivedByPartyA_lte?: string | null | undefined;
  receivedByPartyA_not?: string | null | undefined;
  receivedByPartyA_not_in?: Array<string> | null | undefined;
  signedAmount?: string | null | undefined;
  signedAmount_gt?: string | null | undefined;
  signedAmount_gte?: string | null | undefined;
  signedAmount_in?: Array<string> | null | undefined;
  signedAmount_lt?: string | null | undefined;
  signedAmount_lte?: string | null | undefined;
  signedAmount_not?: string | null | undefined;
  signedAmount_not_in?: Array<string> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  symbolId?: string | null | undefined;
  symbolId_gt?: string | null | undefined;
  symbolId_gte?: string | null | undefined;
  symbolId_in?: Array<string> | null | undefined;
  symbolId_lt?: string | null | undefined;
  symbolId_lte?: string | null | undefined;
  symbolId_not?: string | null | undefined;
  symbolId_not_in?: Array<string> | null | undefined;
  symbolName?: string | null | undefined;
  symbolName_contains?: string | null | undefined;
  symbolName_contains_nocase?: string | null | undefined;
  symbolName_ends_with?: string | null | undefined;
  symbolName_ends_with_nocase?: string | null | undefined;
  symbolName_gt?: string | null | undefined;
  symbolName_gte?: string | null | undefined;
  symbolName_in?: Array<string> | null | undefined;
  symbolName_lt?: string | null | undefined;
  symbolName_lte?: string | null | undefined;
  symbolName_not?: string | null | undefined;
  symbolName_not_contains?: string | null | undefined;
  symbolName_not_contains_nocase?: string | null | undefined;
  symbolName_not_ends_with?: string | null | undefined;
  symbolName_not_ends_with_nocase?: string | null | undefined;
  symbolName_not_in?: Array<string> | null | undefined;
  symbolName_not_starts_with?: string | null | undefined;
  symbolName_not_starts_with_nocase?: string | null | undefined;
  symbolName_starts_with?: string | null | undefined;
  symbolName_starts_with_nocase?: string | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  transaction?: string | null | undefined;
  transaction_contains?: string | null | undefined;
  transaction_gt?: string | null | undefined;
  transaction_gte?: string | null | undefined;
  transaction_in?: Array<string> | null | undefined;
  transaction_lt?: string | null | undefined;
  transaction_lte?: string | null | undefined;
  transaction_not?: string | null | undefined;
  transaction_not_contains?: string | null | undefined;
  transaction_not_in?: Array<string> | null | undefined;
  trigger?: string | null | undefined;
  trigger_contains?: string | null | undefined;
  trigger_contains_nocase?: string | null | undefined;
  trigger_ends_with?: string | null | undefined;
  trigger_ends_with_nocase?: string | null | undefined;
  trigger_gt?: string | null | undefined;
  trigger_gte?: string | null | undefined;
  trigger_in?: Array<string> | null | undefined;
  trigger_lt?: string | null | undefined;
  trigger_lte?: string | null | undefined;
  trigger_not?: string | null | undefined;
  trigger_not_contains?: string | null | undefined;
  trigger_not_contains_nocase?: string | null | undefined;
  trigger_not_ends_with?: string | null | undefined;
  trigger_not_ends_with_nocase?: string | null | undefined;
  trigger_not_in?: Array<string> | null | undefined;
  trigger_not_starts_with?: string | null | undefined;
  trigger_not_starts_with_nocase?: string | null | undefined;
  trigger_starts_with?: string | null | undefined;
  trigger_starts_with_nocase?: string | null | undefined;
};

export type QuoteFundingSettlement_OrderBy =
  | "balanceChanged"
  | "blockNumber"
  | "fundingDeltaPerUnit"
  | "id"
  | "newAccumulatedPaidFunding"
  | "newLastFundingPaymentTimestamp"
  | "newPaidThroughEpoch"
  | "openAmount"
  | "paidByPartyA"
  | "partyA"
  | "partyB"
  | "positionType"
  | "previousAccumulatedPaidFunding"
  | "previousLastFundingPaymentTimestamp"
  | "previousPaidThroughEpoch"
  | "quote"
  | "quoteId"
  | "quote__accumulatedPaidFunding"
  | "quote__action"
  | "quote__affiliate"
  | "quote__averageClosedPrice"
  | "quote__blockNumber"
  | "quote__closeDeadline"
  | "quote__closeFee"
  | "quote__closeId"
  | "quote__closePrice"
  | "quote__closedAmount"
  | "quote__closedPrice"
  | "quote__cva"
  | "quote__feeAffiliate"
  | "quote__fillAmount"
  | "quote__globalCounter"
  | "quote__id"
  | "quote__initialCva"
  | "quote__initialLf"
  | "quote__initialOpenedPrice"
  | "quote__initialPartyAmm"
  | "quote__initialPartyBmm"
  | "quote__lastAdjustmentEpoch"
  | "quote__lastAdjustmentFactor"
  | "quote__lastFundingPaymentTimestamp"
  | "quote__leverage"
  | "quote__lf"
  | "quote__liquidateAmount"
  | "quote__liquidatePrice"
  | "quote__liquidatedSide"
  | "quote__liquidationId"
  | "quote__marketPrice"
  | "quote__maxFundingRate"
  | "quote__openDeadline"
  | "quote__openedPrice"
  | "quote__orderTypeClose"
  | "quote__orderTypeOpen"
  | "quote__paidCloseFee"
  | "quote__paidOpenFee"
  | "quote__partyA"
  | "quote__partyAmm"
  | "quote__partyB"
  | "quote__partyBmm"
  | "quote__positionType"
  | "quote__quantity"
  | "quote__quantityToClose"
  | "quote__quoteId"
  | "quote__quoteStatus"
  | "quote__requestedOpenPrice"
  | "quote__source"
  | "quote__symbol"
  | "quote__symbolId"
  | "quote__timestamp"
  | "quote__timestampFullyClose"
  | "quote__timestampOpenPosition"
  | "quote__timestampSendQuote"
  | "quote__tradingFee"
  | "quote__userPaidFunding"
  | "quote__userReceivedFunding"
  | "receivedByPartyA"
  | "signedAmount"
  | "source"
  | "symbolId"
  | "symbolName"
  | "timestamp"
  | "transaction"
  | "trigger";

export type Quote_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  accumulatedPaidFunding?: string | null | undefined;
  accumulatedPaidFunding_gt?: string | null | undefined;
  accumulatedPaidFunding_gte?: string | null | undefined;
  accumulatedPaidFunding_in?: Array<string> | null | undefined;
  accumulatedPaidFunding_lt?: string | null | undefined;
  accumulatedPaidFunding_lte?: string | null | undefined;
  accumulatedPaidFunding_not?: string | null | undefined;
  accumulatedPaidFunding_not_in?: Array<string> | null | undefined;
  action?: string | null | undefined;
  action_contains?: string | null | undefined;
  action_contains_nocase?: string | null | undefined;
  action_ends_with?: string | null | undefined;
  action_ends_with_nocase?: string | null | undefined;
  action_gt?: string | null | undefined;
  action_gte?: string | null | undefined;
  action_in?: Array<string> | null | undefined;
  action_lt?: string | null | undefined;
  action_lte?: string | null | undefined;
  action_not?: string | null | undefined;
  action_not_contains?: string | null | undefined;
  action_not_contains_nocase?: string | null | undefined;
  action_not_ends_with?: string | null | undefined;
  action_not_ends_with_nocase?: string | null | undefined;
  action_not_in?: Array<string> | null | undefined;
  action_not_starts_with?: string | null | undefined;
  action_not_starts_with_nocase?: string | null | undefined;
  action_starts_with?: string | null | undefined;
  action_starts_with_nocase?: string | null | undefined;
  affiliate?: string | null | undefined;
  affiliate_contains?: string | null | undefined;
  affiliate_gt?: string | null | undefined;
  affiliate_gte?: string | null | undefined;
  affiliate_in?: Array<string> | null | undefined;
  affiliate_lt?: string | null | undefined;
  affiliate_lte?: string | null | undefined;
  affiliate_not?: string | null | undefined;
  affiliate_not_contains?: string | null | undefined;
  affiliate_not_in?: Array<string> | null | undefined;
  and?: Array<Quote_Filter | null | undefined> | null | undefined;
  averageClosedPrice?: string | null | undefined;
  averageClosedPrice_gt?: string | null | undefined;
  averageClosedPrice_gte?: string | null | undefined;
  averageClosedPrice_in?: Array<string> | null | undefined;
  averageClosedPrice_lt?: string | null | undefined;
  averageClosedPrice_lte?: string | null | undefined;
  averageClosedPrice_not?: string | null | undefined;
  averageClosedPrice_not_in?: Array<string> | null | undefined;
  blockNumber?: string | null | undefined;
  blockNumber_gt?: string | null | undefined;
  blockNumber_gte?: string | null | undefined;
  blockNumber_in?: Array<string> | null | undefined;
  blockNumber_lt?: string | null | undefined;
  blockNumber_lte?: string | null | undefined;
  blockNumber_not?: string | null | undefined;
  blockNumber_not_in?: Array<string> | null | undefined;
  closeDeadline?: string | null | undefined;
  closeDeadline_gt?: string | null | undefined;
  closeDeadline_gte?: string | null | undefined;
  closeDeadline_in?: Array<string> | null | undefined;
  closeDeadline_lt?: string | null | undefined;
  closeDeadline_lte?: string | null | undefined;
  closeDeadline_not?: string | null | undefined;
  closeDeadline_not_in?: Array<string> | null | undefined;
  closeFee?: string | null | undefined;
  closeFee_gt?: string | null | undefined;
  closeFee_gte?: string | null | undefined;
  closeFee_in?: Array<string> | null | undefined;
  closeFee_lt?: string | null | undefined;
  closeFee_lte?: string | null | undefined;
  closeFee_not?: string | null | undefined;
  closeFee_not_in?: Array<string> | null | undefined;
  closeId?: string | null | undefined;
  closeId_gt?: string | null | undefined;
  closeId_gte?: string | null | undefined;
  closeId_in?: Array<string> | null | undefined;
  closeId_lt?: string | null | undefined;
  closeId_lte?: string | null | undefined;
  closeId_not?: string | null | undefined;
  closeId_not_in?: Array<string> | null | undefined;
  closePrice?: string | null | undefined;
  closePrice_gt?: string | null | undefined;
  closePrice_gte?: string | null | undefined;
  closePrice_in?: Array<string> | null | undefined;
  closePrice_lt?: string | null | undefined;
  closePrice_lte?: string | null | undefined;
  closePrice_not?: string | null | undefined;
  closePrice_not_in?: Array<string> | null | undefined;
  closedAmount?: string | null | undefined;
  closedAmount_gt?: string | null | undefined;
  closedAmount_gte?: string | null | undefined;
  closedAmount_in?: Array<string> | null | undefined;
  closedAmount_lt?: string | null | undefined;
  closedAmount_lte?: string | null | undefined;
  closedAmount_not?: string | null | undefined;
  closedAmount_not_in?: Array<string> | null | undefined;
  closedPrice?: string | null | undefined;
  closedPrice_gt?: string | null | undefined;
  closedPrice_gte?: string | null | undefined;
  closedPrice_in?: Array<string> | null | undefined;
  closedPrice_lt?: string | null | undefined;
  closedPrice_lte?: string | null | undefined;
  closedPrice_not?: string | null | undefined;
  closedPrice_not_in?: Array<string> | null | undefined;
  cva?: string | null | undefined;
  cva_gt?: string | null | undefined;
  cva_gte?: string | null | undefined;
  cva_in?: Array<string> | null | undefined;
  cva_lt?: string | null | undefined;
  cva_lte?: string | null | undefined;
  cva_not?: string | null | undefined;
  cva_not_in?: Array<string> | null | undefined;
  feeAffiliate?: string | null | undefined;
  feeAffiliate_contains?: string | null | undefined;
  feeAffiliate_gt?: string | null | undefined;
  feeAffiliate_gte?: string | null | undefined;
  feeAffiliate_in?: Array<string> | null | undefined;
  feeAffiliate_lt?: string | null | undefined;
  feeAffiliate_lte?: string | null | undefined;
  feeAffiliate_not?: string | null | undefined;
  feeAffiliate_not_contains?: string | null | undefined;
  feeAffiliate_not_in?: Array<string> | null | undefined;
  fillAmount?: string | null | undefined;
  fillAmount_gt?: string | null | undefined;
  fillAmount_gte?: string | null | undefined;
  fillAmount_in?: Array<string> | null | undefined;
  fillAmount_lt?: string | null | undefined;
  fillAmount_lte?: string | null | undefined;
  fillAmount_not?: string | null | undefined;
  fillAmount_not_in?: Array<string> | null | undefined;
  fundingSettlements_?: QuoteFundingSettlement_Filter | null | undefined;
  globalCounter?: string | null | undefined;
  globalCounter_gt?: string | null | undefined;
  globalCounter_gte?: string | null | undefined;
  globalCounter_in?: Array<string> | null | undefined;
  globalCounter_lt?: string | null | undefined;
  globalCounter_lte?: string | null | undefined;
  globalCounter_not?: string | null | undefined;
  globalCounter_not_in?: Array<string> | null | undefined;
  id?: string | null | undefined;
  id_contains?: string | null | undefined;
  id_contains_nocase?: string | null | undefined;
  id_ends_with?: string | null | undefined;
  id_ends_with_nocase?: string | null | undefined;
  id_gt?: string | null | undefined;
  id_gte?: string | null | undefined;
  id_in?: Array<string> | null | undefined;
  id_lt?: string | null | undefined;
  id_lte?: string | null | undefined;
  id_not?: string | null | undefined;
  id_not_contains?: string | null | undefined;
  id_not_contains_nocase?: string | null | undefined;
  id_not_ends_with?: string | null | undefined;
  id_not_ends_with_nocase?: string | null | undefined;
  id_not_in?: Array<string> | null | undefined;
  id_not_starts_with?: string | null | undefined;
  id_not_starts_with_nocase?: string | null | undefined;
  id_starts_with?: string | null | undefined;
  id_starts_with_nocase?: string | null | undefined;
  initialCva?: string | null | undefined;
  initialCva_gt?: string | null | undefined;
  initialCva_gte?: string | null | undefined;
  initialCva_in?: Array<string> | null | undefined;
  initialCva_lt?: string | null | undefined;
  initialCva_lte?: string | null | undefined;
  initialCva_not?: string | null | undefined;
  initialCva_not_in?: Array<string> | null | undefined;
  initialLf?: string | null | undefined;
  initialLf_gt?: string | null | undefined;
  initialLf_gte?: string | null | undefined;
  initialLf_in?: Array<string> | null | undefined;
  initialLf_lt?: string | null | undefined;
  initialLf_lte?: string | null | undefined;
  initialLf_not?: string | null | undefined;
  initialLf_not_in?: Array<string> | null | undefined;
  initialOpenedPrice?: string | null | undefined;
  initialOpenedPrice_gt?: string | null | undefined;
  initialOpenedPrice_gte?: string | null | undefined;
  initialOpenedPrice_in?: Array<string> | null | undefined;
  initialOpenedPrice_lt?: string | null | undefined;
  initialOpenedPrice_lte?: string | null | undefined;
  initialOpenedPrice_not?: string | null | undefined;
  initialOpenedPrice_not_in?: Array<string> | null | undefined;
  initialPartyAmm?: string | null | undefined;
  initialPartyAmm_gt?: string | null | undefined;
  initialPartyAmm_gte?: string | null | undefined;
  initialPartyAmm_in?: Array<string> | null | undefined;
  initialPartyAmm_lt?: string | null | undefined;
  initialPartyAmm_lte?: string | null | undefined;
  initialPartyAmm_not?: string | null | undefined;
  initialPartyAmm_not_in?: Array<string> | null | undefined;
  initialPartyBmm?: string | null | undefined;
  initialPartyBmm_gt?: string | null | undefined;
  initialPartyBmm_gte?: string | null | undefined;
  initialPartyBmm_in?: Array<string> | null | undefined;
  initialPartyBmm_lt?: string | null | undefined;
  initialPartyBmm_lte?: string | null | undefined;
  initialPartyBmm_not?: string | null | undefined;
  initialPartyBmm_not_in?: Array<string> | null | undefined;
  lastAdjustmentEpoch?: string | null | undefined;
  lastAdjustmentEpoch_gt?: string | null | undefined;
  lastAdjustmentEpoch_gte?: string | null | undefined;
  lastAdjustmentEpoch_in?: Array<string> | null | undefined;
  lastAdjustmentEpoch_lt?: string | null | undefined;
  lastAdjustmentEpoch_lte?: string | null | undefined;
  lastAdjustmentEpoch_not?: string | null | undefined;
  lastAdjustmentEpoch_not_in?: Array<string> | null | undefined;
  lastAdjustmentFactor?: string | null | undefined;
  lastAdjustmentFactor_gt?: string | null | undefined;
  lastAdjustmentFactor_gte?: string | null | undefined;
  lastAdjustmentFactor_in?: Array<string> | null | undefined;
  lastAdjustmentFactor_lt?: string | null | undefined;
  lastAdjustmentFactor_lte?: string | null | undefined;
  lastAdjustmentFactor_not?: string | null | undefined;
  lastAdjustmentFactor_not_in?: Array<string> | null | undefined;
  lastFundingPaymentTimestamp?: string | null | undefined;
  lastFundingPaymentTimestamp_gt?: string | null | undefined;
  lastFundingPaymentTimestamp_gte?: string | null | undefined;
  lastFundingPaymentTimestamp_in?: Array<string> | null | undefined;
  lastFundingPaymentTimestamp_lt?: string | null | undefined;
  lastFundingPaymentTimestamp_lte?: string | null | undefined;
  lastFundingPaymentTimestamp_not?: string | null | undefined;
  lastFundingPaymentTimestamp_not_in?: Array<string> | null | undefined;
  leverage?: string | null | undefined;
  leverage_gt?: string | null | undefined;
  leverage_gte?: string | null | undefined;
  leverage_in?: Array<string> | null | undefined;
  leverage_lt?: string | null | undefined;
  leverage_lte?: string | null | undefined;
  leverage_not?: string | null | undefined;
  leverage_not_in?: Array<string> | null | undefined;
  lf?: string | null | undefined;
  lf_gt?: string | null | undefined;
  lf_gte?: string | null | undefined;
  lf_in?: Array<string> | null | undefined;
  lf_lt?: string | null | undefined;
  lf_lte?: string | null | undefined;
  lf_not?: string | null | undefined;
  lf_not_in?: Array<string> | null | undefined;
  liquidateAmount?: string | null | undefined;
  liquidateAmount_gt?: string | null | undefined;
  liquidateAmount_gte?: string | null | undefined;
  liquidateAmount_in?: Array<string> | null | undefined;
  liquidateAmount_lt?: string | null | undefined;
  liquidateAmount_lte?: string | null | undefined;
  liquidateAmount_not?: string | null | undefined;
  liquidateAmount_not_in?: Array<string> | null | undefined;
  liquidatePrice?: string | null | undefined;
  liquidatePrice_gt?: string | null | undefined;
  liquidatePrice_gte?: string | null | undefined;
  liquidatePrice_in?: Array<string> | null | undefined;
  liquidatePrice_lt?: string | null | undefined;
  liquidatePrice_lte?: string | null | undefined;
  liquidatePrice_not?: string | null | undefined;
  liquidatePrice_not_in?: Array<string> | null | undefined;
  liquidatedSide?: number | null | undefined;
  liquidatedSide_gt?: number | null | undefined;
  liquidatedSide_gte?: number | null | undefined;
  liquidatedSide_in?: Array<number> | null | undefined;
  liquidatedSide_lt?: number | null | undefined;
  liquidatedSide_lte?: number | null | undefined;
  liquidatedSide_not?: number | null | undefined;
  liquidatedSide_not_in?: Array<number> | null | undefined;
  liquidationId?: string | null | undefined;
  liquidationId_contains?: string | null | undefined;
  liquidationId_gt?: string | null | undefined;
  liquidationId_gte?: string | null | undefined;
  liquidationId_in?: Array<string> | null | undefined;
  liquidationId_lt?: string | null | undefined;
  liquidationId_lte?: string | null | undefined;
  liquidationId_not?: string | null | undefined;
  liquidationId_not_contains?: string | null | undefined;
  liquidationId_not_in?: Array<string> | null | undefined;
  marketPrice?: string | null | undefined;
  marketPrice_gt?: string | null | undefined;
  marketPrice_gte?: string | null | undefined;
  marketPrice_in?: Array<string> | null | undefined;
  marketPrice_lt?: string | null | undefined;
  marketPrice_lte?: string | null | undefined;
  marketPrice_not?: string | null | undefined;
  marketPrice_not_in?: Array<string> | null | undefined;
  maxFundingRate?: string | null | undefined;
  maxFundingRate_gt?: string | null | undefined;
  maxFundingRate_gte?: string | null | undefined;
  maxFundingRate_in?: Array<string> | null | undefined;
  maxFundingRate_lt?: string | null | undefined;
  maxFundingRate_lte?: string | null | undefined;
  maxFundingRate_not?: string | null | undefined;
  maxFundingRate_not_in?: Array<string> | null | undefined;
  openDeadline?: string | null | undefined;
  openDeadline_gt?: string | null | undefined;
  openDeadline_gte?: string | null | undefined;
  openDeadline_in?: Array<string> | null | undefined;
  openDeadline_lt?: string | null | undefined;
  openDeadline_lte?: string | null | undefined;
  openDeadline_not?: string | null | undefined;
  openDeadline_not_in?: Array<string> | null | undefined;
  openedPrice?: string | null | undefined;
  openedPrice_gt?: string | null | undefined;
  openedPrice_gte?: string | null | undefined;
  openedPrice_in?: Array<string> | null | undefined;
  openedPrice_lt?: string | null | undefined;
  openedPrice_lte?: string | null | undefined;
  openedPrice_not?: string | null | undefined;
  openedPrice_not_in?: Array<string> | null | undefined;
  or?: Array<Quote_Filter | null | undefined> | null | undefined;
  orderTypeClose?: number | null | undefined;
  orderTypeClose_gt?: number | null | undefined;
  orderTypeClose_gte?: number | null | undefined;
  orderTypeClose_in?: Array<number> | null | undefined;
  orderTypeClose_lt?: number | null | undefined;
  orderTypeClose_lte?: number | null | undefined;
  orderTypeClose_not?: number | null | undefined;
  orderTypeClose_not_in?: Array<number> | null | undefined;
  orderTypeOpen?: number | null | undefined;
  orderTypeOpen_gt?: number | null | undefined;
  orderTypeOpen_gte?: number | null | undefined;
  orderTypeOpen_in?: Array<number> | null | undefined;
  orderTypeOpen_lt?: number | null | undefined;
  orderTypeOpen_lte?: number | null | undefined;
  orderTypeOpen_not?: number | null | undefined;
  orderTypeOpen_not_in?: Array<number> | null | undefined;
  paidCloseFee?: string | null | undefined;
  paidCloseFee_gt?: string | null | undefined;
  paidCloseFee_gte?: string | null | undefined;
  paidCloseFee_in?: Array<string> | null | undefined;
  paidCloseFee_lt?: string | null | undefined;
  paidCloseFee_lte?: string | null | undefined;
  paidCloseFee_not?: string | null | undefined;
  paidCloseFee_not_in?: Array<string> | null | undefined;
  paidOpenFee?: string | null | undefined;
  paidOpenFee_gt?: string | null | undefined;
  paidOpenFee_gte?: string | null | undefined;
  paidOpenFee_in?: Array<string> | null | undefined;
  paidOpenFee_lt?: string | null | undefined;
  paidOpenFee_lte?: string | null | undefined;
  paidOpenFee_not?: string | null | undefined;
  paidOpenFee_not_in?: Array<string> | null | undefined;
  partyA?: string | null | undefined;
  partyAAccount?: string | null | undefined;
  partyAAccount_?: Account_Filter | null | undefined;
  partyAAccount_contains?: string | null | undefined;
  partyAAccount_contains_nocase?: string | null | undefined;
  partyAAccount_ends_with?: string | null | undefined;
  partyAAccount_ends_with_nocase?: string | null | undefined;
  partyAAccount_gt?: string | null | undefined;
  partyAAccount_gte?: string | null | undefined;
  partyAAccount_in?: Array<string> | null | undefined;
  partyAAccount_lt?: string | null | undefined;
  partyAAccount_lte?: string | null | undefined;
  partyAAccount_not?: string | null | undefined;
  partyAAccount_not_contains?: string | null | undefined;
  partyAAccount_not_contains_nocase?: string | null | undefined;
  partyAAccount_not_ends_with?: string | null | undefined;
  partyAAccount_not_ends_with_nocase?: string | null | undefined;
  partyAAccount_not_in?: Array<string> | null | undefined;
  partyAAccount_not_starts_with?: string | null | undefined;
  partyAAccount_not_starts_with_nocase?: string | null | undefined;
  partyAAccount_starts_with?: string | null | undefined;
  partyAAccount_starts_with_nocase?: string | null | undefined;
  partyA_contains?: string | null | undefined;
  partyA_gt?: string | null | undefined;
  partyA_gte?: string | null | undefined;
  partyA_in?: Array<string> | null | undefined;
  partyA_lt?: string | null | undefined;
  partyA_lte?: string | null | undefined;
  partyA_not?: string | null | undefined;
  partyA_not_contains?: string | null | undefined;
  partyA_not_in?: Array<string> | null | undefined;
  partyAmm?: string | null | undefined;
  partyAmm_gt?: string | null | undefined;
  partyAmm_gte?: string | null | undefined;
  partyAmm_in?: Array<string> | null | undefined;
  partyAmm_lt?: string | null | undefined;
  partyAmm_lte?: string | null | undefined;
  partyAmm_not?: string | null | undefined;
  partyAmm_not_in?: Array<string> | null | undefined;
  partyB?: string | null | undefined;
  partyB_contains?: string | null | undefined;
  partyB_gt?: string | null | undefined;
  partyB_gte?: string | null | undefined;
  partyB_in?: Array<string> | null | undefined;
  partyB_lt?: string | null | undefined;
  partyB_lte?: string | null | undefined;
  partyB_not?: string | null | undefined;
  partyB_not_contains?: string | null | undefined;
  partyB_not_in?: Array<string> | null | undefined;
  partyBmm?: string | null | undefined;
  partyBmm_gt?: string | null | undefined;
  partyBmm_gte?: string | null | undefined;
  partyBmm_in?: Array<string> | null | undefined;
  partyBmm_lt?: string | null | undefined;
  partyBmm_lte?: string | null | undefined;
  partyBmm_not?: string | null | undefined;
  partyBmm_not_in?: Array<string> | null | undefined;
  partyBsWhiteList?: Array<string> | null | undefined;
  partyBsWhiteList_contains?: Array<string> | null | undefined;
  partyBsWhiteList_not?: Array<string> | null | undefined;
  partyBsWhiteList_not_contains?: Array<string> | null | undefined;
  positionType?: number | null | undefined;
  positionType_gt?: number | null | undefined;
  positionType_gte?: number | null | undefined;
  positionType_in?: Array<number> | null | undefined;
  positionType_lt?: number | null | undefined;
  positionType_lte?: number | null | undefined;
  positionType_not?: number | null | undefined;
  positionType_not_in?: Array<number> | null | undefined;
  quantity?: string | null | undefined;
  quantityToClose?: string | null | undefined;
  quantityToClose_gt?: string | null | undefined;
  quantityToClose_gte?: string | null | undefined;
  quantityToClose_in?: Array<string> | null | undefined;
  quantityToClose_lt?: string | null | undefined;
  quantityToClose_lte?: string | null | undefined;
  quantityToClose_not?: string | null | undefined;
  quantityToClose_not_in?: Array<string> | null | undefined;
  quantity_gt?: string | null | undefined;
  quantity_gte?: string | null | undefined;
  quantity_in?: Array<string> | null | undefined;
  quantity_lt?: string | null | undefined;
  quantity_lte?: string | null | undefined;
  quantity_not?: string | null | undefined;
  quantity_not_in?: Array<string> | null | undefined;
  quoteEvents_?: QuoteEvent_Filter | null | undefined;
  quoteId?: string | null | undefined;
  quoteId_gt?: string | null | undefined;
  quoteId_gte?: string | null | undefined;
  quoteId_in?: Array<string> | null | undefined;
  quoteId_lt?: string | null | undefined;
  quoteId_lte?: string | null | undefined;
  quoteId_not?: string | null | undefined;
  quoteId_not_in?: Array<string> | null | undefined;
  quoteStatus?: number | null | undefined;
  quoteStatus_gt?: number | null | undefined;
  quoteStatus_gte?: number | null | undefined;
  quoteStatus_in?: Array<number> | null | undefined;
  quoteStatus_lt?: number | null | undefined;
  quoteStatus_lte?: number | null | undefined;
  quoteStatus_not?: number | null | undefined;
  quoteStatus_not_in?: Array<number> | null | undefined;
  requestedOpenPrice?: string | null | undefined;
  requestedOpenPrice_gt?: string | null | undefined;
  requestedOpenPrice_gte?: string | null | undefined;
  requestedOpenPrice_in?: Array<string> | null | undefined;
  requestedOpenPrice_lt?: string | null | undefined;
  requestedOpenPrice_lte?: string | null | undefined;
  requestedOpenPrice_not?: string | null | undefined;
  requestedOpenPrice_not_in?: Array<string> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  subAccount?: string | null | undefined;
  subAccount_?: SubAccount_Filter | null | undefined;
  subAccount_contains?: string | null | undefined;
  subAccount_contains_nocase?: string | null | undefined;
  subAccount_ends_with?: string | null | undefined;
  subAccount_ends_with_nocase?: string | null | undefined;
  subAccount_gt?: string | null | undefined;
  subAccount_gte?: string | null | undefined;
  subAccount_in?: Array<string> | null | undefined;
  subAccount_lt?: string | null | undefined;
  subAccount_lte?: string | null | undefined;
  subAccount_not?: string | null | undefined;
  subAccount_not_contains?: string | null | undefined;
  subAccount_not_contains_nocase?: string | null | undefined;
  subAccount_not_ends_with?: string | null | undefined;
  subAccount_not_ends_with_nocase?: string | null | undefined;
  subAccount_not_in?: Array<string> | null | undefined;
  subAccount_not_starts_with?: string | null | undefined;
  subAccount_not_starts_with_nocase?: string | null | undefined;
  subAccount_starts_with?: string | null | undefined;
  subAccount_starts_with_nocase?: string | null | undefined;
  symbol?: string | null | undefined;
  symbolId?: string | null | undefined;
  symbolId_gt?: string | null | undefined;
  symbolId_gte?: string | null | undefined;
  symbolId_in?: Array<string> | null | undefined;
  symbolId_lt?: string | null | undefined;
  symbolId_lte?: string | null | undefined;
  symbolId_not?: string | null | undefined;
  symbolId_not_in?: Array<string> | null | undefined;
  symbol_contains?: string | null | undefined;
  symbol_contains_nocase?: string | null | undefined;
  symbol_ends_with?: string | null | undefined;
  symbol_ends_with_nocase?: string | null | undefined;
  symbol_gt?: string | null | undefined;
  symbol_gte?: string | null | undefined;
  symbol_in?: Array<string> | null | undefined;
  symbol_lt?: string | null | undefined;
  symbol_lte?: string | null | undefined;
  symbol_not?: string | null | undefined;
  symbol_not_contains?: string | null | undefined;
  symbol_not_contains_nocase?: string | null | undefined;
  symbol_not_ends_with?: string | null | undefined;
  symbol_not_ends_with_nocase?: string | null | undefined;
  symbol_not_in?: Array<string> | null | undefined;
  symbol_not_starts_with?: string | null | undefined;
  symbol_not_starts_with_nocase?: string | null | undefined;
  symbol_starts_with?: string | null | undefined;
  symbol_starts_with_nocase?: string | null | undefined;
  timestamp?: string | null | undefined;
  timestampFullyClose?: string | null | undefined;
  timestampFullyClose_gt?: string | null | undefined;
  timestampFullyClose_gte?: string | null | undefined;
  timestampFullyClose_in?: Array<string> | null | undefined;
  timestampFullyClose_lt?: string | null | undefined;
  timestampFullyClose_lte?: string | null | undefined;
  timestampFullyClose_not?: string | null | undefined;
  timestampFullyClose_not_in?: Array<string> | null | undefined;
  timestampOpenPosition?: string | null | undefined;
  timestampOpenPosition_gt?: string | null | undefined;
  timestampOpenPosition_gte?: string | null | undefined;
  timestampOpenPosition_in?: Array<string> | null | undefined;
  timestampOpenPosition_lt?: string | null | undefined;
  timestampOpenPosition_lte?: string | null | undefined;
  timestampOpenPosition_not?: string | null | undefined;
  timestampOpenPosition_not_in?: Array<string> | null | undefined;
  timestampSendQuote?: string | null | undefined;
  timestampSendQuote_gt?: string | null | undefined;
  timestampSendQuote_gte?: string | null | undefined;
  timestampSendQuote_in?: Array<string> | null | undefined;
  timestampSendQuote_lt?: string | null | undefined;
  timestampSendQuote_lte?: string | null | undefined;
  timestampSendQuote_not?: string | null | undefined;
  timestampSendQuote_not_in?: Array<string> | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  tradingFee?: string | null | undefined;
  tradingFee_gt?: string | null | undefined;
  tradingFee_gte?: string | null | undefined;
  tradingFee_in?: Array<string> | null | undefined;
  tradingFee_lt?: string | null | undefined;
  tradingFee_lte?: string | null | undefined;
  tradingFee_not?: string | null | undefined;
  tradingFee_not_in?: Array<string> | null | undefined;
  userPaidFunding?: string | null | undefined;
  userPaidFunding_gt?: string | null | undefined;
  userPaidFunding_gte?: string | null | undefined;
  userPaidFunding_in?: Array<string> | null | undefined;
  userPaidFunding_lt?: string | null | undefined;
  userPaidFunding_lte?: string | null | undefined;
  userPaidFunding_not?: string | null | undefined;
  userPaidFunding_not_in?: Array<string> | null | undefined;
  userReceivedFunding?: string | null | undefined;
  userReceivedFunding_gt?: string | null | undefined;
  userReceivedFunding_gte?: string | null | undefined;
  userReceivedFunding_in?: Array<string> | null | undefined;
  userReceivedFunding_lt?: string | null | undefined;
  userReceivedFunding_lte?: string | null | undefined;
  userReceivedFunding_not?: string | null | undefined;
  userReceivedFunding_not_in?: Array<string> | null | undefined;
  virtualAccount?: string | null | undefined;
  virtualAccount_?: VirtualAccount_Filter | null | undefined;
  virtualAccount_contains?: string | null | undefined;
  virtualAccount_contains_nocase?: string | null | undefined;
  virtualAccount_ends_with?: string | null | undefined;
  virtualAccount_ends_with_nocase?: string | null | undefined;
  virtualAccount_gt?: string | null | undefined;
  virtualAccount_gte?: string | null | undefined;
  virtualAccount_in?: Array<string> | null | undefined;
  virtualAccount_lt?: string | null | undefined;
  virtualAccount_lte?: string | null | undefined;
  virtualAccount_not?: string | null | undefined;
  virtualAccount_not_contains?: string | null | undefined;
  virtualAccount_not_contains_nocase?: string | null | undefined;
  virtualAccount_not_ends_with?: string | null | undefined;
  virtualAccount_not_ends_with_nocase?: string | null | undefined;
  virtualAccount_not_in?: Array<string> | null | undefined;
  virtualAccount_not_starts_with?: string | null | undefined;
  virtualAccount_not_starts_with_nocase?: string | null | undefined;
  virtualAccount_starts_with?: string | null | undefined;
  virtualAccount_starts_with_nocase?: string | null | undefined;
};

export type Quote_OrderBy =
  | "accumulatedPaidFunding"
  | "action"
  | "affiliate"
  | "averageClosedPrice"
  | "blockNumber"
  | "closeDeadline"
  | "closeFee"
  | "closeId"
  | "closePrice"
  | "closedAmount"
  | "closedPrice"
  | "cva"
  | "feeAffiliate"
  | "fillAmount"
  | "fundingSettlements"
  | "globalCounter"
  | "id"
  | "initialCva"
  | "initialLf"
  | "initialOpenedPrice"
  | "initialPartyAmm"
  | "initialPartyBmm"
  | "lastAdjustmentEpoch"
  | "lastAdjustmentFactor"
  | "lastFundingPaymentTimestamp"
  | "leverage"
  | "lf"
  | "liquidateAmount"
  | "liquidatePrice"
  | "liquidatedSide"
  | "liquidationId"
  | "marketPrice"
  | "maxFundingRate"
  | "openDeadline"
  | "openedPrice"
  | "orderTypeClose"
  | "orderTypeOpen"
  | "paidCloseFee"
  | "paidOpenFee"
  | "partyA"
  | "partyAAccount"
  | "partyAAccount__account"
  | "partyAAccount__accountKind"
  | "partyAAccount__accountLayerSource"
  | "partyAAccount__accountSource"
  | "partyAAccount__affiliate"
  | "partyAAccount__allocated"
  | "partyAAccount__blockNumber"
  | "partyAAccount__coreSource"
  | "partyAAccount__deallocated"
  | "partyAAccount__deploymentId"
  | "partyAAccount__deposit"
  | "partyAAccount__globalCounter"
  | "partyAAccount__id"
  | "partyAAccount__isDeleted"
  | "partyAAccount__isVirtual"
  | "partyAAccount__lastActivityTimestamp"
  | "partyAAccount__lastBalanceActivityTimestamp"
  | "partyAAccount__lastCoreActivityTimestamp"
  | "partyAAccount__lastLayerActivityTimestamp"
  | "partyAAccount__name"
  | "partyAAccount__owner"
  | "partyAAccount__parentAddress"
  | "partyAAccount__positionsCount"
  | "partyAAccount__quotesCount"
  | "partyAAccount__source"
  | "partyAAccount__timestamp"
  | "partyAAccount__transaction"
  | "partyAAccount__type"
  | "partyAAccount__updateTimestamp"
  | "partyAAccount__user"
  | "partyAAccount__withdraw"
  | "partyAmm"
  | "partyB"
  | "partyBmm"
  | "partyBsWhiteList"
  | "positionType"
  | "quantity"
  | "quantityToClose"
  | "quoteEvents"
  | "quoteId"
  | "quoteStatus"
  | "requestedOpenPrice"
  | "source"
  | "subAccount"
  | "subAccount__accountLayerSource"
  | "subAccount__activePositions"
  | "subAccount__activeVirtualAccounts"
  | "subAccount__address"
  | "subAccount__affiliateAddress"
  | "subAccount__cancelledQuotesCount"
  | "subAccount__closedQuotesCount"
  | "subAccount__coreSource"
  | "subAccount__deploymentId"
  | "subAccount__expiredQuotesCount"
  | "subAccount__id"
  | "subAccount__isDeleted"
  | "subAccount__isLegacy"
  | "subAccount__isolationType"
  | "subAccount__lastConfigTimestamp"
  | "subAccount__lastMarginTransferTimestamp"
  | "subAccount__lastTradeTimestamp"
  | "subAccount__latestMarginBalance"
  | "subAccount__legacyContract"
  | "subAccount__legacyImported"
  | "subAccount__legacyImportedTimestamp"
  | "subAccount__liquidatedQuotesCount"
  | "subAccount__metadata"
  | "subAccount__name"
  | "subAccount__openPositionsCount"
  | "subAccount__owner"
  | "subAccount__pendingQuotesCount"
  | "subAccount__rejectedQuotesCount"
  | "subAccount__routingMode"
  | "subAccount__singleVAMode"
  | "subAccount__source"
  | "subAccount__symmioCore"
  | "subAccount__timestamp"
  | "subAccount__totalPositions"
  | "subAccount__totalVirtualAccounts"
  | "subAccount__updateTimestamp"
  | "symbol"
  | "symbolId"
  | "timestamp"
  | "timestampFullyClose"
  | "timestampOpenPosition"
  | "timestampSendQuote"
  | "tradingFee"
  | "userPaidFunding"
  | "userReceivedFunding"
  | "virtualAccount"
  | "virtualAccount__accountLayerSource"
  | "virtualAccount__activePositions"
  | "virtualAccount__address"
  | "virtualAccount__cancelledQuotesCount"
  | "virtualAccount__closedQuotesCount"
  | "virtualAccount__coreSource"
  | "virtualAccount__deploymentId"
  | "virtualAccount__expiredQuotesCount"
  | "virtualAccount__id"
  | "virtualAccount__isDeleted"
  | "virtualAccount__isolationType"
  | "virtualAccount__lastDeleteTimestamp"
  | "virtualAccount__lastMarginTransferTimestamp"
  | "virtualAccount__lastReuseTimestamp"
  | "virtualAccount__lastTradeTimestamp"
  | "virtualAccount__latestMarginBalance"
  | "virtualAccount__liquidatedQuotesCount"
  | "virtualAccount__metadata"
  | "virtualAccount__openPositionsCount"
  | "virtualAccount__owner"
  | "virtualAccount__parentAddress"
  | "virtualAccount__pendingQuotesCount"
  | "virtualAccount__rejectedQuotesCount"
  | "virtualAccount__reuseCount"
  | "virtualAccount__source"
  | "virtualAccount__symbolId"
  | "virtualAccount__timestamp"
  | "virtualAccount__totalPositions"
  | "virtualAccount__updateTimestamp";

export type SubAccount_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  accountLayerSource?: string | null | undefined;
  accountLayerSource_contains?: string | null | undefined;
  accountLayerSource_gt?: string | null | undefined;
  accountLayerSource_gte?: string | null | undefined;
  accountLayerSource_in?: Array<string> | null | undefined;
  accountLayerSource_lt?: string | null | undefined;
  accountLayerSource_lte?: string | null | undefined;
  accountLayerSource_not?: string | null | undefined;
  accountLayerSource_not_contains?: string | null | undefined;
  accountLayerSource_not_in?: Array<string> | null | undefined;
  activePositions?: string | null | undefined;
  activePositions_gt?: string | null | undefined;
  activePositions_gte?: string | null | undefined;
  activePositions_in?: Array<string> | null | undefined;
  activePositions_lt?: string | null | undefined;
  activePositions_lte?: string | null | undefined;
  activePositions_not?: string | null | undefined;
  activePositions_not_in?: Array<string> | null | undefined;
  activeVirtualAccounts?: string | null | undefined;
  activeVirtualAccounts_gt?: string | null | undefined;
  activeVirtualAccounts_gte?: string | null | undefined;
  activeVirtualAccounts_in?: Array<string> | null | undefined;
  activeVirtualAccounts_lt?: string | null | undefined;
  activeVirtualAccounts_lte?: string | null | undefined;
  activeVirtualAccounts_not?: string | null | undefined;
  activeVirtualAccounts_not_in?: Array<string> | null | undefined;
  address?: string | null | undefined;
  address_contains?: string | null | undefined;
  address_gt?: string | null | undefined;
  address_gte?: string | null | undefined;
  address_in?: Array<string> | null | undefined;
  address_lt?: string | null | undefined;
  address_lte?: string | null | undefined;
  address_not?: string | null | undefined;
  address_not_contains?: string | null | undefined;
  address_not_in?: Array<string> | null | undefined;
  affiliate?: string | null | undefined;
  affiliateAddress?: string | null | undefined;
  affiliateAddress_contains?: string | null | undefined;
  affiliateAddress_gt?: string | null | undefined;
  affiliateAddress_gte?: string | null | undefined;
  affiliateAddress_in?: Array<string> | null | undefined;
  affiliateAddress_lt?: string | null | undefined;
  affiliateAddress_lte?: string | null | undefined;
  affiliateAddress_not?: string | null | undefined;
  affiliateAddress_not_contains?: string | null | undefined;
  affiliateAddress_not_in?: Array<string> | null | undefined;
  affiliate_?: Affiliate_Filter | null | undefined;
  affiliate_contains?: string | null | undefined;
  affiliate_contains_nocase?: string | null | undefined;
  affiliate_ends_with?: string | null | undefined;
  affiliate_ends_with_nocase?: string | null | undefined;
  affiliate_gt?: string | null | undefined;
  affiliate_gte?: string | null | undefined;
  affiliate_in?: Array<string> | null | undefined;
  affiliate_lt?: string | null | undefined;
  affiliate_lte?: string | null | undefined;
  affiliate_not?: string | null | undefined;
  affiliate_not_contains?: string | null | undefined;
  affiliate_not_contains_nocase?: string | null | undefined;
  affiliate_not_ends_with?: string | null | undefined;
  affiliate_not_ends_with_nocase?: string | null | undefined;
  affiliate_not_in?: Array<string> | null | undefined;
  affiliate_not_starts_with?: string | null | undefined;
  affiliate_not_starts_with_nocase?: string | null | undefined;
  affiliate_starts_with?: string | null | undefined;
  affiliate_starts_with_nocase?: string | null | undefined;
  and?: Array<SubAccount_Filter | null | undefined> | null | undefined;
  cancelledQuotesCount?: string | null | undefined;
  cancelledQuotesCount_gt?: string | null | undefined;
  cancelledQuotesCount_gte?: string | null | undefined;
  cancelledQuotesCount_in?: Array<string> | null | undefined;
  cancelledQuotesCount_lt?: string | null | undefined;
  cancelledQuotesCount_lte?: string | null | undefined;
  cancelledQuotesCount_not?: string | null | undefined;
  cancelledQuotesCount_not_in?: Array<string> | null | undefined;
  closedQuotesCount?: string | null | undefined;
  closedQuotesCount_gt?: string | null | undefined;
  closedQuotesCount_gte?: string | null | undefined;
  closedQuotesCount_in?: Array<string> | null | undefined;
  closedQuotesCount_lt?: string | null | undefined;
  closedQuotesCount_lte?: string | null | undefined;
  closedQuotesCount_not?: string | null | undefined;
  closedQuotesCount_not_in?: Array<string> | null | undefined;
  coreSource?: string | null | undefined;
  coreSource_contains?: string | null | undefined;
  coreSource_gt?: string | null | undefined;
  coreSource_gte?: string | null | undefined;
  coreSource_in?: Array<string> | null | undefined;
  coreSource_lt?: string | null | undefined;
  coreSource_lte?: string | null | undefined;
  coreSource_not?: string | null | undefined;
  coreSource_not_contains?: string | null | undefined;
  coreSource_not_in?: Array<string> | null | undefined;
  deploymentId?: string | null | undefined;
  deploymentId_contains?: string | null | undefined;
  deploymentId_contains_nocase?: string | null | undefined;
  deploymentId_ends_with?: string | null | undefined;
  deploymentId_ends_with_nocase?: string | null | undefined;
  deploymentId_gt?: string | null | undefined;
  deploymentId_gte?: string | null | undefined;
  deploymentId_in?: Array<string> | null | undefined;
  deploymentId_lt?: string | null | undefined;
  deploymentId_lte?: string | null | undefined;
  deploymentId_not?: string | null | undefined;
  deploymentId_not_contains?: string | null | undefined;
  deploymentId_not_contains_nocase?: string | null | undefined;
  deploymentId_not_ends_with?: string | null | undefined;
  deploymentId_not_ends_with_nocase?: string | null | undefined;
  deploymentId_not_in?: Array<string> | null | undefined;
  deploymentId_not_starts_with?: string | null | undefined;
  deploymentId_not_starts_with_nocase?: string | null | undefined;
  deploymentId_starts_with?: string | null | undefined;
  deploymentId_starts_with_nocase?: string | null | undefined;
  expiredQuotesCount?: string | null | undefined;
  expiredQuotesCount_gt?: string | null | undefined;
  expiredQuotesCount_gte?: string | null | undefined;
  expiredQuotesCount_in?: Array<string> | null | undefined;
  expiredQuotesCount_lt?: string | null | undefined;
  expiredQuotesCount_lte?: string | null | undefined;
  expiredQuotesCount_not?: string | null | undefined;
  expiredQuotesCount_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  isDeleted?: boolean | null | undefined;
  isDeleted_in?: Array<boolean> | null | undefined;
  isDeleted_not?: boolean | null | undefined;
  isDeleted_not_in?: Array<boolean> | null | undefined;
  isLegacy?: boolean | null | undefined;
  isLegacy_in?: Array<boolean> | null | undefined;
  isLegacy_not?: boolean | null | undefined;
  isLegacy_not_in?: Array<boolean> | null | undefined;
  isolationType?: number | null | undefined;
  isolationType_gt?: number | null | undefined;
  isolationType_gte?: number | null | undefined;
  isolationType_in?: Array<number> | null | undefined;
  isolationType_lt?: number | null | undefined;
  isolationType_lte?: number | null | undefined;
  isolationType_not?: number | null | undefined;
  isolationType_not_in?: Array<number> | null | undefined;
  lastConfigTimestamp?: string | null | undefined;
  lastConfigTimestamp_gt?: string | null | undefined;
  lastConfigTimestamp_gte?: string | null | undefined;
  lastConfigTimestamp_in?: Array<string> | null | undefined;
  lastConfigTimestamp_lt?: string | null | undefined;
  lastConfigTimestamp_lte?: string | null | undefined;
  lastConfigTimestamp_not?: string | null | undefined;
  lastConfigTimestamp_not_in?: Array<string> | null | undefined;
  lastMarginTransferTimestamp?: string | null | undefined;
  lastMarginTransferTimestamp_gt?: string | null | undefined;
  lastMarginTransferTimestamp_gte?: string | null | undefined;
  lastMarginTransferTimestamp_in?: Array<string> | null | undefined;
  lastMarginTransferTimestamp_lt?: string | null | undefined;
  lastMarginTransferTimestamp_lte?: string | null | undefined;
  lastMarginTransferTimestamp_not?: string | null | undefined;
  lastMarginTransferTimestamp_not_in?: Array<string> | null | undefined;
  lastTradeTimestamp?: string | null | undefined;
  lastTradeTimestamp_gt?: string | null | undefined;
  lastTradeTimestamp_gte?: string | null | undefined;
  lastTradeTimestamp_in?: Array<string> | null | undefined;
  lastTradeTimestamp_lt?: string | null | undefined;
  lastTradeTimestamp_lte?: string | null | undefined;
  lastTradeTimestamp_not?: string | null | undefined;
  lastTradeTimestamp_not_in?: Array<string> | null | undefined;
  latestMarginBalance?: string | null | undefined;
  latestMarginBalance_gt?: string | null | undefined;
  latestMarginBalance_gte?: string | null | undefined;
  latestMarginBalance_in?: Array<string> | null | undefined;
  latestMarginBalance_lt?: string | null | undefined;
  latestMarginBalance_lte?: string | null | undefined;
  latestMarginBalance_not?: string | null | undefined;
  latestMarginBalance_not_in?: Array<string> | null | undefined;
  legacyContract?: string | null | undefined;
  legacyContract_contains?: string | null | undefined;
  legacyContract_gt?: string | null | undefined;
  legacyContract_gte?: string | null | undefined;
  legacyContract_in?: Array<string> | null | undefined;
  legacyContract_lt?: string | null | undefined;
  legacyContract_lte?: string | null | undefined;
  legacyContract_not?: string | null | undefined;
  legacyContract_not_contains?: string | null | undefined;
  legacyContract_not_in?: Array<string> | null | undefined;
  legacyImported?: boolean | null | undefined;
  legacyImportedTimestamp?: string | null | undefined;
  legacyImportedTimestamp_gt?: string | null | undefined;
  legacyImportedTimestamp_gte?: string | null | undefined;
  legacyImportedTimestamp_in?: Array<string> | null | undefined;
  legacyImportedTimestamp_lt?: string | null | undefined;
  legacyImportedTimestamp_lte?: string | null | undefined;
  legacyImportedTimestamp_not?: string | null | undefined;
  legacyImportedTimestamp_not_in?: Array<string> | null | undefined;
  legacyImported_in?: Array<boolean> | null | undefined;
  legacyImported_not?: boolean | null | undefined;
  legacyImported_not_in?: Array<boolean> | null | undefined;
  liquidatedQuotesCount?: string | null | undefined;
  liquidatedQuotesCount_gt?: string | null | undefined;
  liquidatedQuotesCount_gte?: string | null | undefined;
  liquidatedQuotesCount_in?: Array<string> | null | undefined;
  liquidatedQuotesCount_lt?: string | null | undefined;
  liquidatedQuotesCount_lte?: string | null | undefined;
  liquidatedQuotesCount_not?: string | null | undefined;
  liquidatedQuotesCount_not_in?: Array<string> | null | undefined;
  marginTransfers_?: MarginTransfer_Filter | null | undefined;
  metadata?: string | null | undefined;
  metadata_contains?: string | null | undefined;
  metadata_gt?: string | null | undefined;
  metadata_gte?: string | null | undefined;
  metadata_in?: Array<string> | null | undefined;
  metadata_lt?: string | null | undefined;
  metadata_lte?: string | null | undefined;
  metadata_not?: string | null | undefined;
  metadata_not_contains?: string | null | undefined;
  metadata_not_in?: Array<string> | null | undefined;
  name?: string | null | undefined;
  name_contains?: string | null | undefined;
  name_contains_nocase?: string | null | undefined;
  name_ends_with?: string | null | undefined;
  name_ends_with_nocase?: string | null | undefined;
  name_gt?: string | null | undefined;
  name_gte?: string | null | undefined;
  name_in?: Array<string> | null | undefined;
  name_lt?: string | null | undefined;
  name_lte?: string | null | undefined;
  name_not?: string | null | undefined;
  name_not_contains?: string | null | undefined;
  name_not_contains_nocase?: string | null | undefined;
  name_not_ends_with?: string | null | undefined;
  name_not_ends_with_nocase?: string | null | undefined;
  name_not_in?: Array<string> | null | undefined;
  name_not_starts_with?: string | null | undefined;
  name_not_starts_with_nocase?: string | null | undefined;
  name_starts_with?: string | null | undefined;
  name_starts_with_nocase?: string | null | undefined;
  openPositionsCount?: string | null | undefined;
  openPositionsCount_gt?: string | null | undefined;
  openPositionsCount_gte?: string | null | undefined;
  openPositionsCount_in?: Array<string> | null | undefined;
  openPositionsCount_lt?: string | null | undefined;
  openPositionsCount_lte?: string | null | undefined;
  openPositionsCount_not?: string | null | undefined;
  openPositionsCount_not_in?: Array<string> | null | undefined;
  or?: Array<SubAccount_Filter | null | undefined> | null | undefined;
  owner?: string | null | undefined;
  ownerRef?: string | null | undefined;
  ownerRef_?: User_Filter | null | undefined;
  ownerRef_contains?: string | null | undefined;
  ownerRef_contains_nocase?: string | null | undefined;
  ownerRef_ends_with?: string | null | undefined;
  ownerRef_ends_with_nocase?: string | null | undefined;
  ownerRef_gt?: string | null | undefined;
  ownerRef_gte?: string | null | undefined;
  ownerRef_in?: Array<string> | null | undefined;
  ownerRef_lt?: string | null | undefined;
  ownerRef_lte?: string | null | undefined;
  ownerRef_not?: string | null | undefined;
  ownerRef_not_contains?: string | null | undefined;
  ownerRef_not_contains_nocase?: string | null | undefined;
  ownerRef_not_ends_with?: string | null | undefined;
  ownerRef_not_ends_with_nocase?: string | null | undefined;
  ownerRef_not_in?: Array<string> | null | undefined;
  ownerRef_not_starts_with?: string | null | undefined;
  ownerRef_not_starts_with_nocase?: string | null | undefined;
  ownerRef_starts_with?: string | null | undefined;
  ownerRef_starts_with_nocase?: string | null | undefined;
  owner_contains?: string | null | undefined;
  owner_gt?: string | null | undefined;
  owner_gte?: string | null | undefined;
  owner_in?: Array<string> | null | undefined;
  owner_lt?: string | null | undefined;
  owner_lte?: string | null | undefined;
  owner_not?: string | null | undefined;
  owner_not_contains?: string | null | undefined;
  owner_not_in?: Array<string> | null | undefined;
  pendingQuotesCount?: string | null | undefined;
  pendingQuotesCount_gt?: string | null | undefined;
  pendingQuotesCount_gte?: string | null | undefined;
  pendingQuotesCount_in?: Array<string> | null | undefined;
  pendingQuotesCount_lt?: string | null | undefined;
  pendingQuotesCount_lte?: string | null | undefined;
  pendingQuotesCount_not?: string | null | undefined;
  pendingQuotesCount_not_in?: Array<string> | null | undefined;
  quotes_?: Quote_Filter | null | undefined;
  rejectedQuotesCount?: string | null | undefined;
  rejectedQuotesCount_gt?: string | null | undefined;
  rejectedQuotesCount_gte?: string | null | undefined;
  rejectedQuotesCount_in?: Array<string> | null | undefined;
  rejectedQuotesCount_lt?: string | null | undefined;
  rejectedQuotesCount_lte?: string | null | undefined;
  rejectedQuotesCount_not?: string | null | undefined;
  rejectedQuotesCount_not_in?: Array<string> | null | undefined;
  routingMode?: string | null | undefined;
  routingMode_contains?: string | null | undefined;
  routingMode_contains_nocase?: string | null | undefined;
  routingMode_ends_with?: string | null | undefined;
  routingMode_ends_with_nocase?: string | null | undefined;
  routingMode_gt?: string | null | undefined;
  routingMode_gte?: string | null | undefined;
  routingMode_in?: Array<string> | null | undefined;
  routingMode_lt?: string | null | undefined;
  routingMode_lte?: string | null | undefined;
  routingMode_not?: string | null | undefined;
  routingMode_not_contains?: string | null | undefined;
  routingMode_not_contains_nocase?: string | null | undefined;
  routingMode_not_ends_with?: string | null | undefined;
  routingMode_not_ends_with_nocase?: string | null | undefined;
  routingMode_not_in?: Array<string> | null | undefined;
  routingMode_not_starts_with?: string | null | undefined;
  routingMode_not_starts_with_nocase?: string | null | undefined;
  routingMode_starts_with?: string | null | undefined;
  routingMode_starts_with_nocase?: string | null | undefined;
  singleVAMode?: boolean | null | undefined;
  singleVAMode_in?: Array<boolean> | null | undefined;
  singleVAMode_not?: boolean | null | undefined;
  singleVAMode_not_in?: Array<boolean> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  symmioCore?: string | null | undefined;
  symmioCore_contains?: string | null | undefined;
  symmioCore_gt?: string | null | undefined;
  symmioCore_gte?: string | null | undefined;
  symmioCore_in?: Array<string> | null | undefined;
  symmioCore_lt?: string | null | undefined;
  symmioCore_lte?: string | null | undefined;
  symmioCore_not?: string | null | undefined;
  symmioCore_not_contains?: string | null | undefined;
  symmioCore_not_in?: Array<string> | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  totalPositions?: string | null | undefined;
  totalPositions_gt?: string | null | undefined;
  totalPositions_gte?: string | null | undefined;
  totalPositions_in?: Array<string> | null | undefined;
  totalPositions_lt?: string | null | undefined;
  totalPositions_lte?: string | null | undefined;
  totalPositions_not?: string | null | undefined;
  totalPositions_not_in?: Array<string> | null | undefined;
  totalVirtualAccounts?: string | null | undefined;
  totalVirtualAccounts_gt?: string | null | undefined;
  totalVirtualAccounts_gte?: string | null | undefined;
  totalVirtualAccounts_in?: Array<string> | null | undefined;
  totalVirtualAccounts_lt?: string | null | undefined;
  totalVirtualAccounts_lte?: string | null | undefined;
  totalVirtualAccounts_not?: string | null | undefined;
  totalVirtualAccounts_not_in?: Array<string> | null | undefined;
  updateTimestamp?: string | null | undefined;
  updateTimestamp_gt?: string | null | undefined;
  updateTimestamp_gte?: string | null | undefined;
  updateTimestamp_in?: Array<string> | null | undefined;
  updateTimestamp_lt?: string | null | undefined;
  updateTimestamp_lte?: string | null | undefined;
  updateTimestamp_not?: string | null | undefined;
  updateTimestamp_not_in?: Array<string> | null | undefined;
  virtualAccounts_?: VirtualAccount_Filter | null | undefined;
};

export type User_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  accounts_?: Account_Filter | null | undefined;
  address?: string | null | undefined;
  address_contains?: string | null | undefined;
  address_gt?: string | null | undefined;
  address_gte?: string | null | undefined;
  address_in?: Array<string> | null | undefined;
  address_lt?: string | null | undefined;
  address_lte?: string | null | undefined;
  address_not?: string | null | undefined;
  address_not_contains?: string | null | undefined;
  address_not_in?: Array<string> | null | undefined;
  and?: Array<User_Filter | null | undefined> | null | undefined;
  globalCounter?: string | null | undefined;
  globalCounter_gt?: string | null | undefined;
  globalCounter_gte?: string | null | undefined;
  globalCounter_in?: Array<string> | null | undefined;
  globalCounter_lt?: string | null | undefined;
  globalCounter_lte?: string | null | undefined;
  globalCounter_not?: string | null | undefined;
  globalCounter_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  or?: Array<User_Filter | null | undefined> | null | undefined;
  subAccounts_?: SubAccount_Filter | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  transaction?: string | null | undefined;
  transaction_contains?: string | null | undefined;
  transaction_gt?: string | null | undefined;
  transaction_gte?: string | null | undefined;
  transaction_in?: Array<string> | null | undefined;
  transaction_lt?: string | null | undefined;
  transaction_lte?: string | null | undefined;
  transaction_not?: string | null | undefined;
  transaction_not_contains?: string | null | undefined;
  transaction_not_in?: Array<string> | null | undefined;
  virtualAccounts_?: VirtualAccount_Filter | null | undefined;
};

export type VirtualAccount_Filter = {
  /** Filter for the block changed event. */
  _change_block?: BlockChangedFilter | null | undefined;
  accountLayerSource?: string | null | undefined;
  accountLayerSource_contains?: string | null | undefined;
  accountLayerSource_gt?: string | null | undefined;
  accountLayerSource_gte?: string | null | undefined;
  accountLayerSource_in?: Array<string> | null | undefined;
  accountLayerSource_lt?: string | null | undefined;
  accountLayerSource_lte?: string | null | undefined;
  accountLayerSource_not?: string | null | undefined;
  accountLayerSource_not_contains?: string | null | undefined;
  accountLayerSource_not_in?: Array<string> | null | undefined;
  activePositions?: string | null | undefined;
  activePositions_gt?: string | null | undefined;
  activePositions_gte?: string | null | undefined;
  activePositions_in?: Array<string> | null | undefined;
  activePositions_lt?: string | null | undefined;
  activePositions_lte?: string | null | undefined;
  activePositions_not?: string | null | undefined;
  activePositions_not_in?: Array<string> | null | undefined;
  address?: string | null | undefined;
  address_contains?: string | null | undefined;
  address_gt?: string | null | undefined;
  address_gte?: string | null | undefined;
  address_in?: Array<string> | null | undefined;
  address_lt?: string | null | undefined;
  address_lte?: string | null | undefined;
  address_not?: string | null | undefined;
  address_not_contains?: string | null | undefined;
  address_not_in?: Array<string> | null | undefined;
  and?: Array<VirtualAccount_Filter | null | undefined> | null | undefined;
  cancelledQuotesCount?: string | null | undefined;
  cancelledQuotesCount_gt?: string | null | undefined;
  cancelledQuotesCount_gte?: string | null | undefined;
  cancelledQuotesCount_in?: Array<string> | null | undefined;
  cancelledQuotesCount_lt?: string | null | undefined;
  cancelledQuotesCount_lte?: string | null | undefined;
  cancelledQuotesCount_not?: string | null | undefined;
  cancelledQuotesCount_not_in?: Array<string> | null | undefined;
  closedQuotesCount?: string | null | undefined;
  closedQuotesCount_gt?: string | null | undefined;
  closedQuotesCount_gte?: string | null | undefined;
  closedQuotesCount_in?: Array<string> | null | undefined;
  closedQuotesCount_lt?: string | null | undefined;
  closedQuotesCount_lte?: string | null | undefined;
  closedQuotesCount_not?: string | null | undefined;
  closedQuotesCount_not_in?: Array<string> | null | undefined;
  coreSource?: string | null | undefined;
  coreSource_contains?: string | null | undefined;
  coreSource_gt?: string | null | undefined;
  coreSource_gte?: string | null | undefined;
  coreSource_in?: Array<string> | null | undefined;
  coreSource_lt?: string | null | undefined;
  coreSource_lte?: string | null | undefined;
  coreSource_not?: string | null | undefined;
  coreSource_not_contains?: string | null | undefined;
  coreSource_not_in?: Array<string> | null | undefined;
  deploymentId?: string | null | undefined;
  deploymentId_contains?: string | null | undefined;
  deploymentId_contains_nocase?: string | null | undefined;
  deploymentId_ends_with?: string | null | undefined;
  deploymentId_ends_with_nocase?: string | null | undefined;
  deploymentId_gt?: string | null | undefined;
  deploymentId_gte?: string | null | undefined;
  deploymentId_in?: Array<string> | null | undefined;
  deploymentId_lt?: string | null | undefined;
  deploymentId_lte?: string | null | undefined;
  deploymentId_not?: string | null | undefined;
  deploymentId_not_contains?: string | null | undefined;
  deploymentId_not_contains_nocase?: string | null | undefined;
  deploymentId_not_ends_with?: string | null | undefined;
  deploymentId_not_ends_with_nocase?: string | null | undefined;
  deploymentId_not_in?: Array<string> | null | undefined;
  deploymentId_not_starts_with?: string | null | undefined;
  deploymentId_not_starts_with_nocase?: string | null | undefined;
  deploymentId_starts_with?: string | null | undefined;
  deploymentId_starts_with_nocase?: string | null | undefined;
  expiredQuotesCount?: string | null | undefined;
  expiredQuotesCount_gt?: string | null | undefined;
  expiredQuotesCount_gte?: string | null | undefined;
  expiredQuotesCount_in?: Array<string> | null | undefined;
  expiredQuotesCount_lt?: string | null | undefined;
  expiredQuotesCount_lte?: string | null | undefined;
  expiredQuotesCount_not?: string | null | undefined;
  expiredQuotesCount_not_in?: Array<string> | null | undefined;
  id?: string | number | null | undefined;
  id_gt?: string | number | null | undefined;
  id_gte?: string | number | null | undefined;
  id_in?: Array<string | number> | null | undefined;
  id_lt?: string | number | null | undefined;
  id_lte?: string | number | null | undefined;
  id_not?: string | number | null | undefined;
  id_not_in?: Array<string | number> | null | undefined;
  isDeleted?: boolean | null | undefined;
  isDeleted_in?: Array<boolean> | null | undefined;
  isDeleted_not?: boolean | null | undefined;
  isDeleted_not_in?: Array<boolean> | null | undefined;
  isolationType?: number | null | undefined;
  isolationType_gt?: number | null | undefined;
  isolationType_gte?: number | null | undefined;
  isolationType_in?: Array<number> | null | undefined;
  isolationType_lt?: number | null | undefined;
  isolationType_lte?: number | null | undefined;
  isolationType_not?: number | null | undefined;
  isolationType_not_in?: Array<number> | null | undefined;
  lastDeleteTimestamp?: string | null | undefined;
  lastDeleteTimestamp_gt?: string | null | undefined;
  lastDeleteTimestamp_gte?: string | null | undefined;
  lastDeleteTimestamp_in?: Array<string> | null | undefined;
  lastDeleteTimestamp_lt?: string | null | undefined;
  lastDeleteTimestamp_lte?: string | null | undefined;
  lastDeleteTimestamp_not?: string | null | undefined;
  lastDeleteTimestamp_not_in?: Array<string> | null | undefined;
  lastMarginTransferTimestamp?: string | null | undefined;
  lastMarginTransferTimestamp_gt?: string | null | undefined;
  lastMarginTransferTimestamp_gte?: string | null | undefined;
  lastMarginTransferTimestamp_in?: Array<string> | null | undefined;
  lastMarginTransferTimestamp_lt?: string | null | undefined;
  lastMarginTransferTimestamp_lte?: string | null | undefined;
  lastMarginTransferTimestamp_not?: string | null | undefined;
  lastMarginTransferTimestamp_not_in?: Array<string> | null | undefined;
  lastReuseTimestamp?: string | null | undefined;
  lastReuseTimestamp_gt?: string | null | undefined;
  lastReuseTimestamp_gte?: string | null | undefined;
  lastReuseTimestamp_in?: Array<string> | null | undefined;
  lastReuseTimestamp_lt?: string | null | undefined;
  lastReuseTimestamp_lte?: string | null | undefined;
  lastReuseTimestamp_not?: string | null | undefined;
  lastReuseTimestamp_not_in?: Array<string> | null | undefined;
  lastTradeTimestamp?: string | null | undefined;
  lastTradeTimestamp_gt?: string | null | undefined;
  lastTradeTimestamp_gte?: string | null | undefined;
  lastTradeTimestamp_in?: Array<string> | null | undefined;
  lastTradeTimestamp_lt?: string | null | undefined;
  lastTradeTimestamp_lte?: string | null | undefined;
  lastTradeTimestamp_not?: string | null | undefined;
  lastTradeTimestamp_not_in?: Array<string> | null | undefined;
  latestMarginBalance?: string | null | undefined;
  latestMarginBalance_gt?: string | null | undefined;
  latestMarginBalance_gte?: string | null | undefined;
  latestMarginBalance_in?: Array<string> | null | undefined;
  latestMarginBalance_lt?: string | null | undefined;
  latestMarginBalance_lte?: string | null | undefined;
  latestMarginBalance_not?: string | null | undefined;
  latestMarginBalance_not_in?: Array<string> | null | undefined;
  liquidatedQuotesCount?: string | null | undefined;
  liquidatedQuotesCount_gt?: string | null | undefined;
  liquidatedQuotesCount_gte?: string | null | undefined;
  liquidatedQuotesCount_in?: Array<string> | null | undefined;
  liquidatedQuotesCount_lt?: string | null | undefined;
  liquidatedQuotesCount_lte?: string | null | undefined;
  liquidatedQuotesCount_not?: string | null | undefined;
  liquidatedQuotesCount_not_in?: Array<string> | null | undefined;
  marginTransfers_?: MarginTransfer_Filter | null | undefined;
  metadata?: string | null | undefined;
  metadata_contains?: string | null | undefined;
  metadata_gt?: string | null | undefined;
  metadata_gte?: string | null | undefined;
  metadata_in?: Array<string> | null | undefined;
  metadata_lt?: string | null | undefined;
  metadata_lte?: string | null | undefined;
  metadata_not?: string | null | undefined;
  metadata_not_contains?: string | null | undefined;
  metadata_not_in?: Array<string> | null | undefined;
  openPositionsCount?: string | null | undefined;
  openPositionsCount_gt?: string | null | undefined;
  openPositionsCount_gte?: string | null | undefined;
  openPositionsCount_in?: Array<string> | null | undefined;
  openPositionsCount_lt?: string | null | undefined;
  openPositionsCount_lte?: string | null | undefined;
  openPositionsCount_not?: string | null | undefined;
  openPositionsCount_not_in?: Array<string> | null | undefined;
  or?: Array<VirtualAccount_Filter | null | undefined> | null | undefined;
  owner?: string | null | undefined;
  ownerRef?: string | null | undefined;
  ownerRef_?: User_Filter | null | undefined;
  ownerRef_contains?: string | null | undefined;
  ownerRef_contains_nocase?: string | null | undefined;
  ownerRef_ends_with?: string | null | undefined;
  ownerRef_ends_with_nocase?: string | null | undefined;
  ownerRef_gt?: string | null | undefined;
  ownerRef_gte?: string | null | undefined;
  ownerRef_in?: Array<string> | null | undefined;
  ownerRef_lt?: string | null | undefined;
  ownerRef_lte?: string | null | undefined;
  ownerRef_not?: string | null | undefined;
  ownerRef_not_contains?: string | null | undefined;
  ownerRef_not_contains_nocase?: string | null | undefined;
  ownerRef_not_ends_with?: string | null | undefined;
  ownerRef_not_ends_with_nocase?: string | null | undefined;
  ownerRef_not_in?: Array<string> | null | undefined;
  ownerRef_not_starts_with?: string | null | undefined;
  ownerRef_not_starts_with_nocase?: string | null | undefined;
  ownerRef_starts_with?: string | null | undefined;
  ownerRef_starts_with_nocase?: string | null | undefined;
  owner_contains?: string | null | undefined;
  owner_gt?: string | null | undefined;
  owner_gte?: string | null | undefined;
  owner_in?: Array<string> | null | undefined;
  owner_lt?: string | null | undefined;
  owner_lte?: string | null | undefined;
  owner_not?: string | null | undefined;
  owner_not_contains?: string | null | undefined;
  owner_not_in?: Array<string> | null | undefined;
  parent?: string | null | undefined;
  parentAddress?: string | null | undefined;
  parentAddress_contains?: string | null | undefined;
  parentAddress_gt?: string | null | undefined;
  parentAddress_gte?: string | null | undefined;
  parentAddress_in?: Array<string> | null | undefined;
  parentAddress_lt?: string | null | undefined;
  parentAddress_lte?: string | null | undefined;
  parentAddress_not?: string | null | undefined;
  parentAddress_not_contains?: string | null | undefined;
  parentAddress_not_in?: Array<string> | null | undefined;
  parent_?: SubAccount_Filter | null | undefined;
  parent_contains?: string | null | undefined;
  parent_contains_nocase?: string | null | undefined;
  parent_ends_with?: string | null | undefined;
  parent_ends_with_nocase?: string | null | undefined;
  parent_gt?: string | null | undefined;
  parent_gte?: string | null | undefined;
  parent_in?: Array<string> | null | undefined;
  parent_lt?: string | null | undefined;
  parent_lte?: string | null | undefined;
  parent_not?: string | null | undefined;
  parent_not_contains?: string | null | undefined;
  parent_not_contains_nocase?: string | null | undefined;
  parent_not_ends_with?: string | null | undefined;
  parent_not_ends_with_nocase?: string | null | undefined;
  parent_not_in?: Array<string> | null | undefined;
  parent_not_starts_with?: string | null | undefined;
  parent_not_starts_with_nocase?: string | null | undefined;
  parent_starts_with?: string | null | undefined;
  parent_starts_with_nocase?: string | null | undefined;
  pendingQuotesCount?: string | null | undefined;
  pendingQuotesCount_gt?: string | null | undefined;
  pendingQuotesCount_gte?: string | null | undefined;
  pendingQuotesCount_in?: Array<string> | null | undefined;
  pendingQuotesCount_lt?: string | null | undefined;
  pendingQuotesCount_lte?: string | null | undefined;
  pendingQuotesCount_not?: string | null | undefined;
  pendingQuotesCount_not_in?: Array<string> | null | undefined;
  rejectedQuotesCount?: string | null | undefined;
  rejectedQuotesCount_gt?: string | null | undefined;
  rejectedQuotesCount_gte?: string | null | undefined;
  rejectedQuotesCount_in?: Array<string> | null | undefined;
  rejectedQuotesCount_lt?: string | null | undefined;
  rejectedQuotesCount_lte?: string | null | undefined;
  rejectedQuotesCount_not?: string | null | undefined;
  rejectedQuotesCount_not_in?: Array<string> | null | undefined;
  reuseCount?: string | null | undefined;
  reuseCount_gt?: string | null | undefined;
  reuseCount_gte?: string | null | undefined;
  reuseCount_in?: Array<string> | null | undefined;
  reuseCount_lt?: string | null | undefined;
  reuseCount_lte?: string | null | undefined;
  reuseCount_not?: string | null | undefined;
  reuseCount_not_in?: Array<string> | null | undefined;
  source?: string | null | undefined;
  source_contains?: string | null | undefined;
  source_gt?: string | null | undefined;
  source_gte?: string | null | undefined;
  source_in?: Array<string> | null | undefined;
  source_lt?: string | null | undefined;
  source_lte?: string | null | undefined;
  source_not?: string | null | undefined;
  source_not_contains?: string | null | undefined;
  source_not_in?: Array<string> | null | undefined;
  symbolId?: string | null | undefined;
  symbolId_gt?: string | null | undefined;
  symbolId_gte?: string | null | undefined;
  symbolId_in?: Array<string> | null | undefined;
  symbolId_lt?: string | null | undefined;
  symbolId_lte?: string | null | undefined;
  symbolId_not?: string | null | undefined;
  symbolId_not_in?: Array<string> | null | undefined;
  timestamp?: string | null | undefined;
  timestamp_gt?: string | null | undefined;
  timestamp_gte?: string | null | undefined;
  timestamp_in?: Array<string> | null | undefined;
  timestamp_lt?: string | null | undefined;
  timestamp_lte?: string | null | undefined;
  timestamp_not?: string | null | undefined;
  timestamp_not_in?: Array<string> | null | undefined;
  totalPositions?: string | null | undefined;
  totalPositions_gt?: string | null | undefined;
  totalPositions_gte?: string | null | undefined;
  totalPositions_in?: Array<string> | null | undefined;
  totalPositions_lt?: string | null | undefined;
  totalPositions_lte?: string | null | undefined;
  totalPositions_not?: string | null | undefined;
  totalPositions_not_in?: Array<string> | null | undefined;
  updateTimestamp?: string | null | undefined;
  updateTimestamp_gt?: string | null | undefined;
  updateTimestamp_gte?: string | null | undefined;
  updateTimestamp_in?: Array<string> | null | undefined;
  updateTimestamp_lt?: string | null | undefined;
  updateTimestamp_lte?: string | null | undefined;
  updateTimestamp_not?: string | null | undefined;
  updateTimestamp_not_in?: Array<string> | null | undefined;
};

export type BalanceChangesQueryVariables = Exact<{
  accounts: Array<string> | string;
  typeIn: Array<string> | string;
  isMarginTransferSideEffectIn: Array<boolean> | boolean;
  first: number;
  skip: number;
  orderDirection: OrderDirection;
  startDate: string;
  endDate: string;
}>;

export type BalanceChangesQuery = {
  balanceChanges: Array<{
    id: string;
    type: string;
    amount: string;
    account: string;
    timestamp: string;
    transaction: string;
    isMarginTransferSideEffect: boolean;
    marginTransferType: string | null;
  }>;
};

export type FundingIndexCheckpointsQueryVariables = Exact<{
  where: FundingIndexCheckpoint_Filter;
  first: number;
  skip: number;
  orderBy: FundingIndexCheckpoint_OrderBy;
  orderDirection: OrderDirection;
}>;

export type FundingIndexCheckpointsQuery = {
  fundingIndexCheckpoints: Array<{
    id: string;
    source: string;
    symbolId: string;
    partyB: string;
    eventType: string;
    rawLongRate: string | null;
    rawShortRate: string | null;
    marketPrice: string | null;
    currentLongRate: string | null;
    currentShortRate: string | null;
    accumulatedLongRate: string | null;
    accumulatedShortRate: string | null;
    epochDuration: string | null;
    lastUpdatedEpoch: string | null;
    startEpoch: string | null;
    startEpochTimestamp: string | null;
    snapshotLongFee: string | null;
    snapshotShortFee: string | null;
    timestamp: string;
    blockNumber: string;
    transaction: string;
  }>;
};

export type QuoteFundingSettlementsQueryVariables = Exact<{
  where: QuoteFundingSettlement_Filter;
  first: number;
  skip: number;
  orderBy: QuoteFundingSettlement_OrderBy;
  orderDirection: OrderDirection;
}>;

export type QuoteFundingSettlementsQuery = {
  quoteFundingSettlements: Array<{
    id: string;
    source: string;
    quoteId: string;
    partyA: string;
    partyB: string;
    symbolId: string;
    positionType: number;
    trigger: string;
    openAmount: string;
    signedAmount: string;
    paidByPartyA: string;
    receivedByPartyA: string;
    previousAccumulatedPaidFunding: string;
    newAccumulatedPaidFunding: string;
    fundingDeltaPerUnit: string;
    previousLastFundingPaymentTimestamp: string;
    newLastFundingPaymentTimestamp: string;
    previousPaidThroughEpoch: string | null;
    newPaidThroughEpoch: string | null;
    balanceChanged: boolean;
    timestamp: string;
    blockNumber: string;
    transaction: string;
  }>;
};

export type LiquidationDetailsQueryVariables = Exact<{
  where: LiquidationDetail_Filter;
  first: number;
  skip: number;
  orderBy: LiquidationDetail_OrderBy;
  orderDirection: OrderDirection;
}>;

export type LiquidationDetailsQuery = {
  liquidationDetails: Array<{
    id: string;
    source: string;
    partyA: string;
    liquidationId: string;
    liquidationType: number;
    liquidationTimestamp: string;
    timestamp: string | null;
    lockedCva: string | null;
    lockedLf: string | null;
    lockedPartyAmm: string | null;
    paidCva: string | null;
    paidLf: string | null;
    upnl: string;
    deficit: string;
    liquidationFee: string;
    settled: boolean;
    fullyLiquidated: boolean;
    settlementExpectedAmounts: Array<string> | null;
    settlementActualAmounts: Array<string> | null;
  }>;
};

export type MarginTransfersQueryVariables = Exact<{
  where: MarginTransfer_Filter;
  first: number;
  skip: number;
  orderBy: MarginTransfer_OrderBy;
  orderDirection: OrderDirection;
}>;

export type MarginTransfersQuery = {
  marginTransfers: Array<{
    id: string;
    type: string;
    amount: string;
    source: string;
    timestamp: string;
    blockNumber: string;
    transaction: string;
    virtualAccount: { id: string };
    subAccount: { id: string };
  }>;
};

export type PoolQuotesQueryVariables = Exact<{
  symbolId: string;
  source: string;
  quoteStatuses: Array<number> | number;
  first: number;
  skip: number;
  orderDirection: OrderDirection;
}>;

export type PoolQuotesQuery = {
  quotes: Array<{
    id: string;
    quoteId: string;
    quoteStatus: number | null;
    positionType: number | null;
    orderTypeOpen: number | null;
    symbol: string | null;
    symbolId: string | null;
    partyA: string;
    partyB: string | null;
    quantity: string | null;
    closedAmount: string | null;
    quantityToClose: string | null;
    openedPrice: string | null;
    requestedOpenPrice: string | null;
    averageClosedPrice: string | null;
    closePrice: string | null;
    initialOpenedPrice: string | null;
    liquidateAmount: string | null;
    liquidatePrice: string | null;
    timestamp: string;
    blockNumber: string;
    timestampSendQuote: string | null;
    timestampOpenPosition: string | null;
    closedPrice: string | null;
    marketPrice: string | null;
    tradingFee: string;
    closeFee: string;
    leverage: string | null;
    initialCva: string;
    initialPartyAmm: string | null;
    initialLf: string;
    userPaidFunding: string | null;
    userReceivedFunding: string | null;
    subAccount: { id: string; owner: string } | null;
  }>;
};

export type PoolQuoteEventsQueryVariables = Exact<{
  typeIn: Array<string> | string;
  symbolId: string;
  source: string;
  first: number;
  skip: number;
  orderDirection: OrderDirection;
}>;

export type PoolQuoteEventsQuery = {
  quoteEvents: Array<{
    id: string;
    type: string;
    metadata: string | null;
    timestamp: string;
    quoteId: string;
    blockNumber: string;
    transaction: string;
    source: string;
    quote: {
      id: string;
      timestamp: string;
      blockNumber: string;
      userPaidFunding: string | null;
      userReceivedFunding: string | null;
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
      initialOpenedPrice: string | null;
      requestedOpenPrice: string | null;
      marketPrice: string | null;
      averageClosedPrice: string | null;
      closePrice: string | null;
      closedPrice: string | null;
      closedAmount: string | null;
      quantityToClose: string | null;
      liquidateAmount: string | null;
      liquidatePrice: string | null;
      tradingFee: string;
      closeFee: string;
      leverage: string | null;
      cva: string | null;
      lf: string | null;
      initialCva: string;
      initialLf: string;
      initialPartyAmm: string | null;
      timestampSendQuote: string | null;
      timestampOpenPosition: string | null;
      subAccount: { id: string; owner: string } | null;
      sendQuoteEvents: Array<{ transaction: string }>;
      openPositionEvents: Array<{ metadata: string | null }>;
    };
  }>;
};

export type QuoteEventsForQuoteByTypeQueryVariables = Exact<{
  where: QuoteEvent_Filter;
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
  where: Quote_Filter;
  first: number;
}>;

export type QuotesFundingQuery = {
  quotes: Array<{ quoteId: string; userPaidFunding: string | null; userReceivedFunding: string | null }>;
};

export type QuoteEventsForHistoryQueryVariables = Exact<{
  where: QuoteEvent_Filter;
  first: number;
  skip: number;
  orderDirection: OrderDirection;
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
    source: string;
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
      initialOpenedPrice: string | null;
      requestedOpenPrice: string | null;
      marketPrice: string | null;
      averageClosedPrice: string | null;
      closePrice: string | null;
      closedPrice: string | null;
      closedAmount: string | null;
      quantityToClose: string | null;
      liquidateAmount: string | null;
      liquidatePrice: string | null;
      tradingFee: string;
      closeFee: string;
      leverage: string | null;
      cva: string | null;
      lf: string | null;
      initialCva: string;
      initialLf: string;
      initialPartyAmm: string | null;
      timestampSendQuote: string | null;
      timestampOpenPosition: string | null;
      subAccount: { id: string; owner: string } | null;
      sendQuoteEvents: Array<{ transaction: string }>;
      openPositionEvents: Array<{ metadata: string | null }>;
    };
  }>;
};

export type QuoteEventsForQuotesByTypeQueryVariables = Exact<{
  where: QuoteEvent_Filter;
  first: number;
  skip: number;
  orderDirection: OrderDirection;
}>;

export type QuoteEventsForQuotesByTypeQuery = {
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

export type SubgraphQuotesQueryVariables = Exact<{
  where: Quote_Filter;
  first: number;
  skip: number;
  orderBy: Quote_OrderBy;
  orderDirection: OrderDirection;
}>;

export type SubgraphQuotesQuery = {
  quotes: Array<{
    id: string;
    source: string;
    quoteId: string;
    quoteStatus: number | null;
    partyA: string;
    partyB: string | null;
    symbolId: string | null;
    symbol: string | null;
    positionType: number | null;
    quantity: string | null;
    fillAmount: string | null;
    closedAmount: string | null;
    openedPrice: string | null;
    accumulatedPaidFunding: string | null;
    lastFundingPaymentTimestamp: string | null;
    userPaidFunding: string | null;
    userReceivedFunding: string | null;
    timestampSendQuote: string | null;
    timestampOpenPosition: string | null;
    timestampFullyClose: string | null;
    timestamp: string;
    blockNumber: string;
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

export const BalanceChangesDocument = new TypedDocumentString(`
    query BalanceChanges($accounts: [Bytes!]!, $typeIn: [String!]!, $isMarginTransferSideEffectIn: [Boolean!]!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!, $startDate: BigInt!, $endDate: BigInt!) {
  balanceChanges(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: $orderDirection
    where: {account_in: $accounts, type_in: $typeIn, isMarginTransferSideEffect_in: $isMarginTransferSideEffectIn, timestamp_gte: $startDate, timestamp_lte: $endDate}
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
    `) as unknown as TypedDocumentString<BalanceChangesQuery, BalanceChangesQueryVariables>;
export const FundingIndexCheckpointsDocument = new TypedDocumentString(`
    query FundingIndexCheckpoints($where: FundingIndexCheckpoint_filter!, $first: Int!, $skip: Int!, $orderBy: FundingIndexCheckpoint_orderBy!, $orderDirection: OrderDirection!) {
  fundingIndexCheckpoints(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    id
    source
    symbolId
    partyB
    eventType
    rawLongRate
    rawShortRate
    marketPrice
    currentLongRate
    currentShortRate
    accumulatedLongRate
    accumulatedShortRate
    epochDuration
    lastUpdatedEpoch
    startEpoch
    startEpochTimestamp
    snapshotLongFee
    snapshotShortFee
    timestamp
    blockNumber
    transaction
  }
}
    `) as unknown as TypedDocumentString<FundingIndexCheckpointsQuery, FundingIndexCheckpointsQueryVariables>;
export const QuoteFundingSettlementsDocument = new TypedDocumentString(`
    query QuoteFundingSettlements($where: QuoteFundingSettlement_filter!, $first: Int!, $skip: Int!, $orderBy: QuoteFundingSettlement_orderBy!, $orderDirection: OrderDirection!) {
  quoteFundingSettlements(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    id
    source
    quoteId
    partyA
    partyB
    symbolId
    positionType
    trigger
    openAmount
    signedAmount
    paidByPartyA
    receivedByPartyA
    previousAccumulatedPaidFunding
    newAccumulatedPaidFunding
    fundingDeltaPerUnit
    previousLastFundingPaymentTimestamp
    newLastFundingPaymentTimestamp
    previousPaidThroughEpoch
    newPaidThroughEpoch
    balanceChanged
    timestamp
    blockNumber
    transaction
  }
}
    `) as unknown as TypedDocumentString<QuoteFundingSettlementsQuery, QuoteFundingSettlementsQueryVariables>;
export const LiquidationDetailsDocument = new TypedDocumentString(`
    query LiquidationDetails($where: LiquidationDetail_filter!, $first: Int!, $skip: Int!, $orderBy: LiquidationDetail_orderBy!, $orderDirection: OrderDirection!) {
  liquidationDetails(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    id
    source
    partyA
    liquidationId
    liquidationType
    liquidationTimestamp
    timestamp
    lockedCva
    lockedLf
    lockedPartyAmm
    paidCva
    paidLf
    upnl
    deficit
    liquidationFee
    settled
    fullyLiquidated
    settlementExpectedAmounts
    settlementActualAmounts
  }
}
    `) as unknown as TypedDocumentString<LiquidationDetailsQuery, LiquidationDetailsQueryVariables>;
export const MarginTransfersDocument = new TypedDocumentString(`
    query MarginTransfers($where: MarginTransfer_filter!, $first: Int!, $skip: Int!, $orderBy: MarginTransfer_orderBy!, $orderDirection: OrderDirection!) {
  marginTransfers(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
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
    `) as unknown as TypedDocumentString<MarginTransfersQuery, MarginTransfersQueryVariables>;
export const PoolQuotesDocument = new TypedDocumentString(`
    query PoolQuotes($symbolId: BigInt!, $source: Bytes!, $quoteStatuses: [Int!]!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!) {
  quotes(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: $orderDirection
    where: {symbolId: $symbolId, source: $source, quoteStatus_in: $quoteStatuses}
  ) {
    id
    quoteId
    quoteStatus
    positionType
    orderTypeOpen
    symbol
    symbolId
    partyA
    partyB
    quantity
    closedAmount
    quantityToClose
    openedPrice
    requestedOpenPrice
    averageClosedPrice
    closePrice
    initialOpenedPrice
    liquidateAmount
    liquidatePrice
    timestamp
    blockNumber
    timestampSendQuote
    timestampOpenPosition
    subAccount {
      id
      owner
    }
    closedPrice
    marketPrice
    tradingFee
    closeFee
    leverage
    initialCva
    initialPartyAmm
    initialLf
    userPaidFunding
    userReceivedFunding
  }
}
    `) as unknown as TypedDocumentString<PoolQuotesQuery, PoolQuotesQueryVariables>;
export const PoolQuoteEventsDocument = new TypedDocumentString(`
    query PoolQuoteEvents($typeIn: [String!]!, $symbolId: BigInt!, $source: Bytes!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!) {
  quoteEvents(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: $orderDirection
    where: {type_in: $typeIn, quote_: {symbolId: $symbolId, source: $source}}
  ) {
    id
    type
    metadata
    timestamp
    quoteId
    blockNumber
    transaction
    source
    quote {
      id
      timestamp
      blockNumber
      userPaidFunding
      userReceivedFunding
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
        owner
      }
      quantity
      openedPrice
      initialOpenedPrice
      requestedOpenPrice
      marketPrice
      averageClosedPrice
      closePrice
      closedPrice
      closedAmount
      quantityToClose
      liquidateAmount
      liquidatePrice
      tradingFee
      closeFee
      leverage
      cva
      lf
      initialCva
      initialLf
      initialPartyAmm
      timestampSendQuote
      timestampOpenPosition
      sendQuoteEvents: quoteEvents(where: {type: "SEND_QUOTE"}, first: 1) {
        transaction
      }
      openPositionEvents: quoteEvents(where: {type: "OPEN_POSITION"}, first: 1000) {
        metadata
      }
    }
  }
}
    `) as unknown as TypedDocumentString<PoolQuoteEventsQuery, PoolQuoteEventsQueryVariables>;
export const QuoteEventsForQuoteByTypeDocument = new TypedDocumentString(`
    query QuoteEventsForQuoteByType($where: QuoteEvent_filter!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!) {
  quoteEvents(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: $orderDirection
    where: $where
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
    query QuotesFunding($where: Quote_filter!, $first: Int!) {
  quotes(first: $first, where: $where) {
    quoteId
    userPaidFunding
    userReceivedFunding
  }
}
    `) as unknown as TypedDocumentString<QuotesFundingQuery, QuotesFundingQueryVariables>;
export const QuoteEventsForHistoryDocument = new TypedDocumentString(`
    query QuoteEventsForHistory($where: QuoteEvent_filter!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!) {
  quoteEvents(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: $orderDirection
    where: $where
  ) {
    id
    type
    metadata
    timestamp
    quoteId
    blockNumber
    transaction
    source
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
        owner
      }
      quantity
      openedPrice
      initialOpenedPrice
      requestedOpenPrice
      marketPrice
      averageClosedPrice
      closePrice
      closedPrice
      closedAmount
      quantityToClose
      liquidateAmount
      liquidatePrice
      tradingFee
      closeFee
      leverage
      cva
      lf
      initialCva
      initialLf
      initialPartyAmm
      timestampSendQuote
      timestampOpenPosition
      sendQuoteEvents: quoteEvents(where: {type: "SEND_QUOTE"}, first: 1) {
        transaction
      }
      openPositionEvents: quoteEvents(where: {type: "OPEN_POSITION"}, first: 1000) {
        metadata
      }
    }
  }
}
    `) as unknown as TypedDocumentString<QuoteEventsForHistoryQuery, QuoteEventsForHistoryQueryVariables>;
export const QuoteEventsForQuotesByTypeDocument = new TypedDocumentString(`
    query QuoteEventsForQuotesByType($where: QuoteEvent_filter!, $first: Int!, $skip: Int!, $orderDirection: OrderDirection!) {
  quoteEvents(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: $orderDirection
    where: $where
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
    `) as unknown as TypedDocumentString<QuoteEventsForQuotesByTypeQuery, QuoteEventsForQuotesByTypeQueryVariables>;
export const SubgraphQuotesDocument = new TypedDocumentString(`
    query SubgraphQuotes($where: Quote_filter!, $first: Int!, $skip: Int!, $orderBy: Quote_orderBy!, $orderDirection: OrderDirection!) {
  quotes(
    first: $first
    skip: $skip
    orderBy: $orderBy
    orderDirection: $orderDirection
    where: $where
  ) {
    id
    source
    quoteId
    quoteStatus
    partyA
    partyB
    symbolId
    symbol
    positionType
    quantity
    fillAmount
    closedAmount
    openedPrice
    accumulatedPaidFunding
    lastFundingPaymentTimestamp
    userPaidFunding
    userReceivedFunding
    timestampSendQuote
    timestampOpenPosition
    timestampFullyClose
    timestamp
    blockNumber
  }
}
    `) as unknown as TypedDocumentString<SubgraphQuotesQuery, SubgraphQuotesQueryVariables>;
