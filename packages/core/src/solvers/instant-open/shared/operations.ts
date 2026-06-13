import type { Address, Hex } from "viem";
import type { Config, SymmioWalletClient } from "../../../core/config";
import { getInstantLayerEip712Domain, signSignedOperation } from "./eip712";
import type { InstantOperationPayload, SignedOperation, SignedOperationPayload } from "./types";

/**
 * Generate a random 32-byte hex salt.
 *
 * Uses `globalThis.crypto.getRandomValues`. Available in modern Node (≥19) and
 * every browser. Caller can pass an explicit `salt` to `buildSignedOperation`
 * for deterministic tests.
 */
export function generateSalt(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex as Hex;
}

/**
 * Parameters for {@link buildSignedOperation}.
 */
export interface BuildSignedOperationParameters {
  /** Session-key signer address. */
  signer: Address;
  /** Contract to call (account-layer for addMargin, symmio diamond for sendQuote). */
  target: Address;
  /** ABI-encoded calldata for the `target` call. */
  callData: Hex;
  /** Sub-account / partyA address (the account whose authority the op runs under). */
  signerAccount: Address;
  /** Unix-seconds deadline. */
  deadline: bigint;
  /** Operation nonce. Defaults to `0n` (single-use). */
  nonce?: bigint;
  /** Override the random salt. Defaults to a fresh `generateSalt()` result. */
  salt?: Hex;
}

/**
 * Build an unsigned {@link SignedOperation} struct.
 *
 * `flexFields` is always empty and `maxUses` is always `1n` for lowcap flows.
 * Pass `salt` to make the result deterministic in tests; otherwise a random
 * 32-byte salt is generated.
 */
export function buildSignedOperation(parameters: BuildSignedOperationParameters): SignedOperation {
  return {
    signer: parameters.signer,
    target: parameters.target,
    callData: parameters.callData,
    signerAccount: {
      addr: parameters.signerAccount,
      isPartyB: false,
    },
    flexFields: [],
    maxUses: 1n,
    replayAttackHeader: {
      nonce: parameters.nonce ?? 0n,
      deadline: parameters.deadline,
      salt: parameters.salt ?? generateSalt(),
    },
  };
}

/**
 * Serialize a {@link SignedOperation} to the wire-format expected by the hedger
 * REST API.
 *
 * `bigint` fields convert to `number` via `Number()` to match the orval-typed
 * `Eip712SignedOperationJSON` schema. All values used in lowcap flows
 * (`maxUses=1`, `nonce=0`, `deadline≈unix seconds`) fit safely in JS `number`.
 */
export function formatSignedOperationPayload(operation: SignedOperation): SignedOperationPayload {
  return {
    signer: operation.signer,
    target: operation.target,
    callData: operation.callData,
    signerAccount: { addr: operation.signerAccount.addr, isPartyB: operation.signerAccount.isPartyB },
    flexFields: operation.flexFields.map((f) => ({
      offset: Number(f.offset),
      length: Number(f.length),
      authorizedFlexFiller: f.authorizedFlexFiller,
    })),
    maxUses: Number(operation.maxUses),
    replayAttackHeader: {
      nonce: Number(operation.replayAttackHeader.nonce),
      deadline: Number(operation.replayAttackHeader.deadline),
      salt: operation.replayAttackHeader.salt,
    },
  };
}

/**
 * Parameters for {@link signAndFormatInstantOperation}.
 */
export interface SignAndFormatInstantOperationParameters {
  /** The operation to sign. */
  operation: SignedOperation;
  /** Optional chain id; defaults to the config's `defaultChainId`. */
  chainId?: number;
  /** Resolved wallet client whose hoisted account performs the EIP-712 signing. */
  walletClient: SymmioWalletClient;
}

/**
 * EIP-712 sign a {@link SignedOperation} and format it as the API payload
 * `{ signedOperation, signature }`.
 *
 * Domain is resolved from the chain config (`instantLayerEip712Domain` + the
 * chain's `instantLayerAddress` as `verifyingContract`).
 */
export async function signAndFormatInstantOperation(
  config: Config,
  parameters: SignAndFormatInstantOperationParameters,
): Promise<InstantOperationPayload> {
  const domain = getInstantLayerEip712Domain(config, { chainId: parameters.chainId });
  const signature = await signSignedOperation(parameters.operation, domain, parameters.walletClient);
  return {
    signedOperation: formatSignedOperationPayload(parameters.operation),
    signature,
  };
}
