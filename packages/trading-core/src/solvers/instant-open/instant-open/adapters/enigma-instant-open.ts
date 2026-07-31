import { SymmError } from "../../../../shared/errors/symm-error";
import {
  encodeAddMarginToNextVA,
  encodeSendQuoteWithAffiliateAndData,
  getFakeSendQuoteMuonSignature,
  sendQuoteUpnlSigFlexRange,
} from "../../shared/calldata";
import { sendInstantOpen } from "../../shared/hedger-api";
import { buildSignedOperation, signAndFormatInstantOperation } from "../../shared/operations";
import { ORDER_TYPE_MARKET, isolationTypeForSide } from "../../shared/types";
import type { EnigmaInstantOpenResult, InstantOpenParameters } from "../types";
import type { InstantOpenAdapterContext } from "./context";

/**
 * Submit an instant open to an **Enigma** (lowcap) hedger.
 *
 * Signs two operations — `addMarginToNextVA` on the AccountLayer and
 * `sendQuote` on the diamond — and posts both to `/instant_trade/instant_open`.
 *
 * The quote carries a **placeholder** Muon signature: lowcap bypasses Muon
 * verification, but the contract still reads `upnlSig.price`, and the encoded
 * signature region is delegated to the solver via a `FlexField` so it can write a
 * live attestation at execution time. Only the `sendQuote` operation carries the
 * delegation; `addMargin` stays fully fixed.
 *
 * @throws {SymmError} `INSTANT_OPEN_MARGIN_REQUIRED` when `margin` is absent —
 *   reachable when the caller omitted `solverId` and the chain's default solver
 *   turned out to be Enigma.
 * @throws {SymmApiError} when the hedger request fails.
 * @internal
 */
export async function submitEnigmaInstantOpen(
  context: InstantOpenAdapterContext,
  parameters: InstantOpenParameters,
): Promise<EnigmaInstantOpenResult> {
  if (!parameters.margin) {
    throw new SymmError(
      "validation",
      "INSTANT_OPEN_MARGIN_REQUIRED",
      "instantOpen: the Enigma (lowcap) flow funds a new virtual account, so `margin.amount` is required.",
    );
  }

  const { config, solver, chainConfig, walletClient, signerAddress, deadline, symbolId, metadata } = context;
  const { accountLayerAddress, symmioAddress, affiliatesAddress } = chainConfig.addresses;

  const addMarginCallData = encodeAddMarginToNextVA({
    subAccount: parameters.subAccountAddress,
    isolationType: isolationTypeForSide(parameters.positionType),
    symbolId,
    amount: parameters.margin.amount,
  });

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
    data: metadata,
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
    flexFields: [{ ...sendQuoteUpnlSigFlexRange(sendQuoteCallData), authorizedFlexFiller: solver.address }],
  });

  const [addMargin, sendQuote] = await Promise.all([
    signAndFormatInstantOperation(config, { operation: addMarginOp, chainId: context.chainId, walletClient }),
    signAndFormatInstantOperation(config, { operation: sendQuoteOp, chainId: context.chainId, walletClient }),
  ]);

  const response = await sendInstantOpen(config, {
    chainId: context.chainId,
    solverId: "enigma",
    request: { addMargin, sendQuote },
  });

  return {
    kind: "enigma",
    success: true,
    tempQuoteId:
      response.temp_quote_id !== undefined && response.temp_quote_id !== null
        ? String(response.temp_quote_id)
        : undefined,
    partyBmm: response.partyBmm,
  };
}
