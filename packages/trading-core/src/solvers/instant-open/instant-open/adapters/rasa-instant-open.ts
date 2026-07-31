import { getSendQuoteUpnlSig } from "../../../../muon/send-quote-upnl-sig";
import { toRasaInstantOpen } from "../../get-instant-opens/adapters/rasa-instant-opens";
import { encodeSendQuoteWithAffiliateAndData } from "../../shared/calldata";
import { sendRasaInstantOpen } from "../../shared/hedger-api";
import { buildSignedOperation, signAndFormatInstantOperation } from "../../shared/operations";
import { ORDER_TYPE_MARKET } from "../../shared/types";
import type { InstantOpenParameters, RasaInstantOpenResult } from "../types";
import type { InstantOpenAdapterContext } from "./context";

/**
 * Submit an instant open to a **Rasa** (majors) hedger.
 *
 * Signs a single `sendQuote` operation on the diamond, under the sub-account's
 * authority, and posts it to `/instant_trade/open`. Rasa is cross-margin: there
 * is no virtual account and no `addMargin` leg, so the request body carries only
 * `sendQuote`.
 *
 * Unlike the Enigma flow, Rasa enforces Muon verification — the quote must carry
 * a live `uPnl_A_withSymbolPrice` attestation. It is fetched here, immediately
 * before signing, because the signature is encoded *inside* the signed calldata
 * and cannot be filled in afterwards. That also means no `flexFields`: there is
 * nothing to delegate.
 *
 * @throws {SymmError} when the Muon attestation cannot be fetched.
 * @throws {SymmApiError} when the hedger request fails.
 * @internal
 */
export async function submitRasaInstantOpen(
  context: InstantOpenAdapterContext,
  parameters: InstantOpenParameters,
): Promise<RasaInstantOpenResult> {
  const { config, solver, chainConfig, walletClient, signerAddress, deadline, symbolId, metadata } = context;
  const { symmioAddress, affiliatesAddress } = chainConfig.addresses;

  /** Fetch last: the attestation is short-lived and is signed into the calldata. */
  const upnlSig = await getSendQuoteUpnlSig(config, {
    chainId: context.chainId,
    partyA: parameters.subAccountAddress,
    symbolId,
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
    upnlSig,
  });

  const sendQuoteOp = buildSignedOperation({
    signer: signerAddress,
    target: symmioAddress,
    callData: sendQuoteCallData,
    signerAccount: parameters.subAccountAddress,
    deadline,
    salt: parameters.sendQuoteSalt,
  });

  const sendQuote = await signAndFormatInstantOperation(config, {
    operation: sendQuoteOp,
    chainId: context.chainId,
    walletClient,
  });

  const response = await sendRasaInstantOpen(config, {
    chainId: context.chainId,
    solverId: "rasa",
    sendQuote,
  });

  const rfq = toRasaInstantOpen(response);

  return {
    kind: "rasa",
    success: true,
    tempQuoteId: String(response.temp_quote_id),
    partyBmm: response.partyBmm,
    rfq,
  };
}
