import { assertInstantSignerDelegated } from "../../../shared/instant-delegation-preflight";
import {
  encodeAddMarginToNextVA,
  encodeSendQuote,
  encodeSendQuoteWithAffiliateAndData,
  getFakeSendQuoteMuonSignature,
  sendQuoteUpnlSigFlexRange,
} from "../../shared/calldata";
import { buildSignedOperation, signAndFormatInstantOperation } from "../../shared/operations";
import { ORDER_TYPE_MARKET, isolationTypeForSide } from "../../shared/types";
import { submitPreparedInstantOpen } from "../prepared/submit-prepared-instant-open";
import type { PreparedInstantOpen } from "../prepared/types";
import type { EnigmaInstantOpenResult, InstantOpenParameters } from "../types";
import type { InstantOpenAdapterContext } from "./context";
import { assertEnigmaMarginTimelockFresh, prepareEnigmaMarginTimelock } from "./enigma-margin-timelock";

/**
 * Submit an instant open to an **Enigma** (lowcap) hedger.
 *
 * Always signs `sendQuote`; when `margin` is present it also signs
 * `addMarginToNextVA` and posts both to `/instant_trade/instant_open`.
 *
 * The quote carries a **placeholder** Muon signature: lowcap bypasses Muon
 * verification, but the contract still reads `upnlSig.price`, and the encoded
 * signature region is delegated to the solver via a `FlexField` so it can write a
 * live attestation at execution time. Only `sendQuote` carries this Muon flex
 * field. Solvers advertising timelock approval metadata receive a wrapped
 * margin operation with only the approval signature bytes delegated to the solver.
 *
 * @throws {SymmError} `INSTANT_SIGNER_NOT_DELEGATED` when the signer lacks the
 *   delegation for either operation, before anything is signed.
 * @throws {SymmApiError} when the hedger request fails.
 * @internal
 */
export async function submitEnigmaInstantOpen(
  context: InstantOpenAdapterContext,
  parameters: InstantOpenParameters,
): Promise<EnigmaInstantOpenResult> {
  return submitPreparedInstantOpen(context.config, { prepared: await prepareEnigmaInstantOpen(context, parameters) });
}

/** Sign without submitting, allowing the consumer to persist the exact payload first. @internal */
export async function prepareEnigmaInstantOpen(
  context: InstantOpenAdapterContext,
  parameters: InstantOpenParameters,
): Promise<PreparedInstantOpen> {
  const { config, solver, chainConfig, walletClient, signerAddress, deadline, symbolId, metadata } = context;
  const { accountLayerAddress, symmioAddress, affiliatesAddress } = chainConfig.addresses;

  const addMarginCallData = parameters.margin
    ? encodeAddMarginToNextVA({
        subAccount: parameters.subAccountAddress,
        isolationType: isolationTypeForSide(parameters.positionType),
        symbolId,
        amount: parameters.margin.amount,
      })
    : undefined;

  const quoteArgs = {
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
    upnlSig: getFakeSendQuoteMuonSignature(parameters.markPrice ?? parameters.order.price),
  };

  /**
   * Which quote-send call to sign is a chain-generation fact: a v0.8.5 diamond
   * has no capped `sendQuote` selector (the calldata would revert), and a
   * v0.8.6 solver rejects the legacy call's zero fee caps.
   */
  const sendQuoteCallData =
    chainConfig.contractsVersion === "0.8.5"
      ? encodeSendQuoteWithAffiliateAndData(quoteArgs)
      : encodeSendQuote({ ...quoteArgs, solverFeeCaps: parameters.solverFeeCaps });

  const margin = addMarginCallData
    ? await prepareEnigmaMarginTimelock(
        context,
        parameters.subAccountAddress,
        addMarginCallData,
        parameters.marginApprovalDeadline ?? parameters.operationDeadline ?? deadline,
      )
    : undefined;
  const addMarginOp = margin
    ? buildSignedOperation({
        signer: signerAddress,
        target: accountLayerAddress,
        callData: margin.callData,
        flexFields: margin.flexFields,
        signerAccount: parameters.subAccountAddress,
        deadline: parameters.operationDeadline ?? deadline,
        salt: parameters.addMarginSalt,
      })
    : undefined;

  const sendQuoteOp = buildSignedOperation({
    signer: signerAddress,
    target: symmioAddress,
    callData: sendQuoteCallData,
    signerAccount: parameters.subAccountAddress,
    deadline: parameters.operationDeadline ?? deadline,
    salt: parameters.sendQuoteSalt,
    flexFields: [{ ...sendQuoteUpnlSigFlexRange(sendQuoteCallData), authorizedFlexFiller: solver.address }],
  });

  await assertInstantSignerDelegated(config, {
    chainId: context.chainId,
    action: "instantOpen",
    // InstantLayer unwraps executeTimelockOp before checking delegation. The
    // inner call is immutable, so validate exactly that selector here as well.
    operations:
      addMarginOp && addMarginCallData ? [{ ...addMarginOp, callData: addMarginCallData }, sendQuoteOp] : [sendQuoteOp],
    enabled: parameters.preflightDelegation,
  });

  const [addMargin, sendQuote] = await Promise.all([
    addMarginOp
      ? signAndFormatInstantOperation(config, { operation: addMarginOp, chainId: context.chainId, walletClient })
      : undefined,
    signAndFormatInstantOperation(config, { operation: sendQuoteOp, chainId: context.chainId, walletClient }),
  ]);

  await assertEnigmaMarginTimelockFresh(context, margin?.approvalDeadline);

  return {
    kind: "enigma",
    chainId: chainConfig.chainId,
    deploymentKey: config.getChainConfigKey(chainConfig.chainId),
    solverId: solver.id,
    request: addMargin ? { addMargin, sendQuote } : { sendQuote },
    timelock: margin?.approvalDeadline !== undefined,
  };
}
