import { decodeFunctionData, isHex } from "viem";
import type { Config } from "../../../../core/config";
import { SymmError } from "../../../../shared/errors/symm-error";
import { accountLayerAbi } from "../../../../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../../../../symmio-contracts/abi/v0.8.6/symmio";
import { sendInstantOpen } from "../../shared/hedger-api";
import type { EnigmaInstantOpenResult } from "../types";
import type { SubmitPreparedInstantOpenParameters } from "./types";

/**
 * Submit the exact signed payload, without fetching a wallet, changing salts or issuing a public approval.
 * @param config - Same deployment configuration used at preparation.
 * @param parameters - Persisted prepared request. Reconcile ambiguous acceptance before retransmitting it.
 * @returns Admission acknowledgement, not proof of an opened position.
 * @example await submitPreparedInstantOpen(config, { prepared });
 */
export async function submitPreparedInstantOpen(
  config: Config,
  parameters: SubmitPreparedInstantOpenParameters,
): Promise<EnigmaInstantOpenResult> {
  const prepared = structuredClone(parameters.prepared);
  const solver = config.getSolver({ chainId: prepared.chainId, solverId: prepared.solverId });
  if (
    prepared.kind !== "enigma" ||
    solver.id !== "enigma" ||
    prepared.deploymentKey !== config.getChainConfigKey(prepared.chainId)
  ) {
    throw new SymmError(
      "validation",
      "PREPARED_INSTANT_OPEN_DEPLOYMENT_MISMATCH",
      "Prepared request belongs to another deployment. Do not reroute a signed request.",
    );
  }
  // Inspect signed bytes, not caller-supplied expiry metadata. This does not alter
  // legacy instantOpen deadlines; the new margin contract requires the shared buffer.
  if (prepared.timelock) {
    const { timestamp } = await config.getClient({ chainId: prepared.chainId }).getBlock({ blockTag: "latest" });
    const quoteData = prepared.request.sendQuote.signedOperation.callData;
    if (!isHex(quoteData))
      throw new SymmError("validation", "INVALID_PREPARED_INSTANT_OPEN", "Quote calldata must be hex bytes.");
    const quote = decodeFunctionData({ abi: symmioAbi, data: quoteData });
    if (quote.functionName !== "sendQuote")
      throw new SymmError(
        "validation",
        "INVALID_PREPARED_INSTANT_OPEN",
        "Wrapped margin requires the current Core sendQuote call.",
      );
    const deadlines = [BigInt(prepared.request.sendQuote.signedOperation.replayAttackHeader.deadline), quote.args[10]];
    const margin = prepared.request.addMargin;
    if (margin) {
      const marginData = margin.signedOperation.callData;
      if (!isHex(marginData))
        throw new SymmError("validation", "INVALID_PREPARED_INSTANT_OPEN", "Margin calldata must be hex bytes.");
      const decoded = decodeFunctionData({ abi: accountLayerAbi, data: marginData });
      if (decoded.functionName !== "executeTimelockOp" || decoded.args[0].length !== 1)
        throw new SymmError("validation", "INVALID_PREPARED_INSTANT_OPEN", "Expected exactly one margin approval.");
      deadlines.push(BigInt(margin.signedOperation.replayAttackHeader.deadline), decoded.args[0][0]!.approval.deadline);
    }
    if (deadlines.some((deadline) => deadline - timestamp < 30n))
      throw new SymmError(
        "validation",
        "INSTANT_OPEN_DEADLINE_EXPIRED",
        "A signed quote, operation or approval has less than 30 seconds remaining. Reconcile before creating a new intent.",
      );
  }
  const response = await sendInstantOpen(config, {
    chainId: prepared.chainId,
    solverId: prepared.solverId,
    request: prepared.request,
  });
  return {
    kind: "enigma",
    success: true,
    tempQuoteId: response.temp_quote_id == null ? undefined : String(response.temp_quote_id),
    partyBmm: response.partyBmm,
  };
}
