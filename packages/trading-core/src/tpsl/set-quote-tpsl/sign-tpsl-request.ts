import type { TypedDataDomain } from "viem";
import type { SymmioWalletClient } from "../../core/config";
import type { TpSlConditionalOrderMessage, TpSlDeleteMessage, TpSlSignedRequest, TpSlSigningSpec } from "../types";
import { toSignableTpSlMessage } from "./build-conditional-order-message";

/**
 * Sign a TP/SL message with the session-key wallet and produce the
 * `{ typedData, signature, signer }` body the handler expects.
 *
 * The handler's signing spec drives `domain` / `types` / `primaryType` so the
 * SDK never hardcodes the EIP-712 schema; it always matches the deployed
 * handler. `null` legs are padded with {@link ZERO_LEG} before signing because
 * EIP-712 can't hash null structs.
 */
export async function signTpSlRequest(parameters: {
  signingSpec: TpSlSigningSpec;
  message: TpSlConditionalOrderMessage | TpSlDeleteMessage;
  walletClient: SymmioWalletClient;
}): Promise<TpSlSignedRequest> {
  const { signingSpec, message, walletClient } = parameters;
  const domain: TypedDataDomain = {
    name: signingSpec.domain.name,
    version: signingSpec.domain.version,
    chainId: signingSpec.domain.chainId,
    verifyingContract: signingSpec.domain.verifyingContract,
  };

  const signable = toSignableTpSlMessage(message as unknown as Record<string, unknown>);

  const signature = await walletClient.signTypedData({
    account: walletClient.account,
    domain,
    types: signingSpec.types,
    primaryType: signingSpec.primaryType,
    message: signable,
  });

  return {
    typedData: {
      types: signingSpec.types,
      primaryType: signingSpec.primaryType,
      domain: signingSpec.domain,
      message: signable,
    },
    signature,
    signer: walletClient.account.address,
  };
}
