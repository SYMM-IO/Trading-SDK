import type { Address, Hex } from "viem";
import type { Config } from "../../../core/config";
import type { Compute, WriteSolverParameter } from "../../../shared/types/properties";
import {
  buildQuoteMetadata,
  encodeAddMarginToNextVA,
  encodeSendQuoteWithAffiliateAndData,
  getFakeSendQuoteMuonSignature,
} from "../shared/calldata";
import { sendInstantOpen } from "../shared/hedger-api";
import { buildSignedOperation, signAndFormatInstantOperation } from "../shared/operations";
import { getMarketOrderDeadline } from "../shared/trade-math";
import {
  ORDER_TYPE_MARKET,
  PositionType,
  VIRTUAL_ACCOUNT_ISOLATION_TYPE,
  type InstantOpenLockedParams,
  type InstantOpenMargin,
  type InstantOpenOrder,
} from "../shared/types";

/**
 * Parameters for the pure {@link instantOpen} primitive.
 *
 * Every domain value is the **final** 18-decimal-wei `bigint` ready to feed
 * `sendQuoteWithAffiliateAndData` and `addMarginToNextVA`. The caller (or the
 * `prepareInstantOpenParams` wizard) is responsible for trade math,
 * platform-fee calc, and margin calc.
 */
export type InstantOpenParameters = Compute<
  WriteSolverParameter & {
    /** Sub-account / partyA address (`signerAccount.addr` + `addMargin` subAccount). */
    subAccountAddress: Address;
    /** Market `symbol_id`. */
    marketId: number;
    /** Trade side. */
    positionType: PositionType;
    /** Order-side values (`price`, `quantity`) — both 18-decimal-wei `bigint`. */
    order: InstantOpenOrder;
    /** Locked-margin breakdown (`cva`, `lf`, `partyAmm`, `partyBmm`) — all 18-decimal-wei `bigint`. */
    lockedParam: InstantOpenLockedParams;
    /** Margin context (`amount`) — 18-decimal-wei `bigint`. */
    margin: InstantOpenMargin;
    /** Override the metadata UUID. Defaults to `globalThis.crypto.randomUUID()`. */
    uuid?: string;
    /** Override the addMargin salt. Defaults to a random 32-byte salt. */
    addMarginSalt?: Hex;
    /** Override the sendQuote salt. Defaults to a random 32-byte salt. */
    sendQuoteSalt?: Hex;
    /** Override the unix-seconds deadline (defaults to `now + 300s`). */
    deadline?: bigint;
  }
>;

/**
 * Return type of {@link instantOpen} and `instantOpenAuto`.
 */
export interface InstantOpenReturnType {
  /** `true` if the hedger accepted the request. */
  success: boolean;
  /** Hedger-issued temporary quote id (numeric string). */
  tempQuoteId?: string;
  /** Hedger response `partyBmm` field, if any. */
  partyBmm?: string;
}

/**
 * Open a lowcap instant position via the InstantLayer v2 flow.
 *
 * Pure primitive — every domain value is already final wei. Builds calldata,
 * signs two operations (`addMarginToNextVA`, `sendQuoteWithAffiliateAndData`),
 * submits them to the chain's solver/hedger `/instant_trade/instant_open`
 * endpoint. Does no math, no fetching.
 *
 * Use `prepareInstantOpenParams` to derive this shape from UI-shape inputs,
 * or `instantOpenAuto` for the combined convenience.
 *
 * @throws {SymmApiError} when the hedger request fails.
 *
 * @example
 * ```ts
 * const { tempQuoteId } = await instantOpen(config, {
 *   subAccountAddress,
 *   // from: signerAddress — omit to use config.defaultWalletAddress
 *   marketId: 1, positionType: "LONG",
 *   order: {
 *     price: 50_000_000_000_000_000_000n,
 *     quantity: 1_000_000_000_000_000_000n,
 *   },
 *   lockedParam: {
 *     cva: 1_000_000_000_000_000_000n,
 *     lf: 500_000_000_000_000_000n,
 *     partyAmm: 1_500_000_000_000_000_000n,
 *     partyBmm: 1_500_000_000_000_000_000n,
 *   },
 *   margin: { amount: 3_000_000_000_000_000_000n },
 * });
 * ```
 */
export async function instantOpen(config: Config, parameters: InstantOpenParameters): Promise<InstantOpenReturnType> {
  const chainConfig = config.getChainConfig(parameters.chainId);
  const { accountLayerAddress, symmioAddress, affiliatesAddress } = chainConfig.addresses;
  const { solver } = chainConfig;

  const walletClient = await config.getWalletClient({ chainId: parameters.chainId, from: parameters.from });
  const signerAddress = walletClient.account.address;

  const deadline = parameters.deadline ?? getMarketOrderDeadline();
  const symbolId = BigInt(parameters.marketId);

  const isolationType =
    parameters.positionType === PositionType.SHORT
      ? VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_SHORT
      : VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG;

  const addMarginCallData = encodeAddMarginToNextVA({
    subAccount: parameters.subAccountAddress,
    isolationType,
    symbolId,
    amount: parameters.margin.amount,
  });

  const uuid = parameters.uuid ?? globalThis.crypto.randomUUID();
  const sendQuoteCallData = encodeSendQuoteWithAffiliateAndData({
    partyBsWhiteList: [solver.address],
    symbolId,
    positionType: parameters.positionType,
    orderType: ORDER_TYPE_MARKET,
    price: parameters.order.price,
    quantity: parameters.order.quantity,
    cva: parameters.lockedParam.cva,
    lf: parameters.lockedParam.lf,
    partyAmm: parameters.lockedParam.partyAmm,
    partyBmm: parameters.lockedParam.partyBmm,
    deadline,
    affiliate: affiliatesAddress,
    data: buildQuoteMetadata(uuid),
    upnlSig: getFakeSendQuoteMuonSignature(parameters.order.price),
  });

  const addMarginOp = buildSignedOperation({
    signer: signerAddress,
    target: accountLayerAddress,
    callData: addMarginCallData,
    signerAccount: parameters.subAccountAddress,
    deadline,
    salt: parameters.addMarginSalt,
  });

  const sendQuoteOp = buildSignedOperation({
    signer: signerAddress,
    target: symmioAddress,
    callData: sendQuoteCallData,
    signerAccount: parameters.subAccountAddress,
    deadline,
    salt: parameters.sendQuoteSalt,
  });

  const [addMargin, sendQuote] = await Promise.all([
    signAndFormatInstantOperation(config, {
      operation: addMarginOp,
      chainId: parameters.chainId,
      walletClient,
    }),
    signAndFormatInstantOperation(config, {
      operation: sendQuoteOp,
      chainId: parameters.chainId,
      walletClient,
    }),
  ]);

  const response = await sendInstantOpen(config, {
    chainId: parameters.chainId,
    request: { addMargin, sendQuote },
  });

  return {
    success: true,
    tempQuoteId:
      response.temp_quote_id !== undefined && response.temp_quote_id !== null
        ? String(response.temp_quote_id)
        : undefined,
    partyBmm: response.partyBmm,
  };
}
