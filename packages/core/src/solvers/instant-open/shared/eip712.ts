import type { Hex, TypedDataDomain } from "viem";
import type { Config, SymmioWalletClient } from "../../../core/config";
import type { SignedOperation } from "./types";

/**
 * EIP-712 type definitions for `SignedOperation`.
 *
 * Mirrors the InstantLayer contract struct exactly — order, names, and
 * solidity types here must match the contract or signatures will not verify.
 */
export const SIGNED_OPERATION_TYPES: Record<string, { name: string; type: string }[]> = {
  SignedOperation: [
    { name: "signer", type: "address" },
    { name: "target", type: "address" },
    { name: "callData", type: "bytes" },
    { name: "signerAccount", type: "Account" },
    { name: "flexFields", type: "FlexField[]" },
    { name: "maxUses", type: "uint256" },
    { name: "replayAttackHeader", type: "ReplayAttackHeader" },
  ],
  Account: [
    { name: "addr", type: "address" },
    { name: "isPartyB", type: "bool" },
  ],
  FlexField: [
    { name: "offset", type: "uint256" },
    { name: "length", type: "uint256" },
    { name: "authorizedFlexFiller", type: "address" },
  ],
  ReplayAttackHeader: [
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "salt", type: "bytes32" },
  ],
};

/**
 * EIP-712 domain `name` for the InstantLayer contract. Hardcoded — same across
 * every supported chain.
 */
export const INSTANT_LAYER_EIP712_DOMAIN_NAME = "SymmioInstantLayer" as const;

/**
 * EIP-712 domain `version` for the InstantLayer contract. Hardcoded — same
 * across every supported chain.
 */
export const INSTANT_LAYER_EIP712_DOMAIN_VERSION = "1" as const;

/**
 * Build the EIP-712 `TypedDataDomain` for the InstantLayer contract.
 *
 * `name`/`version` are hardcoded ({@link INSTANT_LAYER_EIP712_DOMAIN_NAME} /
 * {@link INSTANT_LAYER_EIP712_DOMAIN_VERSION}). `verifyingContract` is the
 * chain's `instantLayerAddress`.
 */
export function getInstantLayerEip712Domain(
  config: Config,
  options: { chainId?: number },
): TypedDataDomain {
  const chainConfig = config.getChainConfig(options.chainId);
  return {
    name: INSTANT_LAYER_EIP712_DOMAIN_NAME,
    version: INSTANT_LAYER_EIP712_DOMAIN_VERSION,
    chainId: chainConfig.chainId,
    verifyingContract: chainConfig.addresses.instantLayerAddress,
  };
}

/**
 * Sign a `SignedOperation` with the supplied viem wallet client.
 *
 * @returns 65-byte hex EIP-712 signature.
 */
export async function signSignedOperation(
  operation: SignedOperation,
  domain: TypedDataDomain,
  walletClient: SymmioWalletClient,
): Promise<Hex> {
  return walletClient.signTypedData({
    account: walletClient.account,
    domain,
    types: SIGNED_OPERATION_TYPES,
    primaryType: "SignedOperation",
    message: {
      signer: operation.signer,
      target: operation.target,
      callData: operation.callData,
      signerAccount: {
        addr: operation.signerAccount.addr,
        isPartyB: operation.signerAccount.isPartyB,
      },
      flexFields: operation.flexFields,
      maxUses: operation.maxUses,
      replayAttackHeader: {
        nonce: operation.replayAttackHeader.nonce,
        deadline: operation.replayAttackHeader.deadline,
        salt: operation.replayAttackHeader.salt,
      },
    },
  });
}
