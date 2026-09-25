import {
  GASLESS_WALLET_OPERATION_TYPES,
  SIGNED_OPERATION_TYPES,
  SymmioSupportedChainId,
  getGaslessGatewayEip712Domain,
  getInstantLayerEip712Domain,
  type Config,
  type GaslessFeeQuoteOperation,
  type GaslessSignedOperationInput,
  type RelayInstantOperationsParameters,
  type SignedOperation,
} from "@symmio/trading-core";
import { isAddress, isAddressEqual, maxUint256, recoverTypedDataAddress, size, type Address, type Hex } from "viem";

const MAX_BUNDLE_CHARACTERS = 250_000;
const ARBITRUM_CHAIN_ID = SymmioSupportedChainId.ARBITRUM;

/** The EIP-712 domain/type table used to produce one imported signature. */
export type OperationSignatureScheme = "instant-layer" | "gasless-wallet";

/** One parsed operation. Signatures remain in memory and are never serialized by this module. */
export interface PreparedOperationEntry {
  operation: SignedOperation;
  walletId: bigint;
  signature?: Hex;
  signatureScheme?: OperationSignatureScheme;
  fills: readonly Hex[];
  flexFillerSignatures: readonly Hex[];
}

/** A locally prepared batch that can always be quoted and may be complete enough to relay. */
export interface PreparedOperationBundle {
  chainId: typeof ARBITRUM_CHAIN_ID;
  operations: readonly PreparedOperationEntry[];
  userAddress?: Address;
  operationType?: string;
  accountId?: string;
  templateId?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

/** A concise, path-aware failure suitable for the local import form. */
export class OperationBundleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationBundleError";
  }
}

/**
 * Parse the operation-lab JSON format without retaining its source text.
 *
 * Unsigned entries are valid for fee previews. Relaying additionally requires
 * `userAddress`, `operationType`, and one signature plus `signatureScheme` per
 * entry. Every uint accepts a decimal string (preferred) or a safe JSON number.
 */
export function parseOperationBundleJson(source: string): PreparedOperationBundle {
  if (source.length > MAX_BUNDLE_CHARACTERS) {
    throw new OperationBundleError(`Bundle is larger than ${MAX_BUNDLE_CHARACTERS.toLocaleString()} characters.`);
  }

  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    throw new OperationBundleError("Bundle is not valid JSON.");
  }

  const root = readRecord(value, "bundle");
  assertOnlyKeys(root, "bundle", [
    "chainId",
    "operations",
    "userAddress",
    "operationType",
    "accountId",
    "templateId",
    "idempotencyKey",
    "metadata",
  ]);

  if (root.chainId !== undefined) {
    const chainId = readSafeInteger(root.chainId, "bundle.chainId");
    if (chainId !== ARBITRUM_CHAIN_ID) {
      throw new OperationBundleError(`bundle.chainId must be Arbitrum (${ARBITRUM_CHAIN_ID}).`);
    }
  }

  const operationsValue = readArray(root.operations, "bundle.operations");
  if (operationsValue.length === 0) {
    throw new OperationBundleError("bundle.operations must contain at least one operation.");
  }
  const operations = operationsValue.map((entry, index) => parseOperationEntry(entry, index));

  const userAddress = readOptionalAddress(root.userAddress, "bundle.userAddress");
  const operationType = readOptionalBoundedString(root.operationType, "bundle.operationType", 128);
  const accountId = readOptionalString(root.accountId, "bundle.accountId");
  const templateId = root.templateId === undefined ? undefined : readSafeInteger(root.templateId, "bundle.templateId");
  const idempotencyKey = readOptionalBoundedString(root.idempotencyKey, "bundle.idempotencyKey", 128);
  const metadata = root.metadata === undefined ? undefined : readRecord(root.metadata, "bundle.metadata");

  return {
    chainId: ARBITRUM_CHAIN_ID,
    operations,
    ...(userAddress ? { userAddress } : {}),
    ...(operationType ? { operationType } : {}),
    ...(accountId !== undefined ? { accountId } : {}),
    ...(templateId !== undefined ? { templateId } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

/** Strip signatures and relay metadata for the read-only fee-preview hook. */
export function toFeeQuoteOperations(bundle: PreparedOperationBundle): readonly GaslessFeeQuoteOperation[] {
  return bundle.operations.map(({ operation, walletId }) => ({ operation, walletId }));
}

/** Explain why an imported bundle is quote-only rather than relay-ready. */
export function getRelayReadinessIssues(
  bundle: PreparedOperationBundle,
  nowSeconds: bigint = BigInt(Math.floor(Date.now() / 1_000)),
): readonly string[] {
  const issues: string[] = [];
  if (!bundle.userAddress) issues.push("Add bundle.userAddress.");
  if (!bundle.operationType) issues.push("Add bundle.operationType (1–128 characters).");

  bundle.operations.forEach((entry, index) => {
    const label = `Operation ${index + 1}`;
    if (!entry.signature) issues.push(`${label} has no 65-byte signature.`);
    if (!entry.signatureScheme) issues.push(`${label} has no signatureScheme.`);
    if (entry.operation.replayAttackHeader.deadline <= nowSeconds) issues.push(`${label} has expired.`);

    if (entry.signatureScheme === "gasless-wallet") {
      if (entry.operation.flexFields.length > 0 || entry.operation.maxUses !== 1n) {
        issues.push(`${label} is a gasless-wallet signature, so flexFields must be empty and maxUses must be 1.`);
      }
      if (entry.fills.length > 0 || entry.flexFillerSignatures.length > 0) {
        issues.push(`${label} is a gasless-wallet signature and cannot carry flex fills.`);
      }
    }
    if (entry.signatureScheme === "instant-layer" && entry.walletId !== 0n) {
      issues.push(`${label} uses the InstantLayer signature scheme but selects a non-zero gasless wallet id.`);
    }
  });

  if (bundle.templateId !== undefined && bundle.operations.some((entry) => entry.walletId !== 0n)) {
    issues.push("Template batches can only use wallet id 0.");
  }
  return issues;
}

/**
 * Recover every signer under the declared EIP-712 scheme.
 *
 * This proves the imported bytes sign the imported operation on Prism's
 * Arbitrum deployment. It does not simulate the operation or prove its nonce is
 * still current; the GaslessLayer and relayer remain authoritative for those.
 */
export async function verifyOperationBundleSignatures(config: Config, bundle: PreparedOperationBundle): Promise<void> {
  const readiness = getRelayReadinessIssues(bundle);
  if (readiness.length > 0) throw new OperationBundleError(readiness[0] ?? "Bundle is not relay-ready.");

  const instantLayerDomain = getInstantLayerEip712Domain(config, { chainId: ARBITRUM_CHAIN_ID });
  const gaslessWalletDomain = getGaslessGatewayEip712Domain(config, { chainId: ARBITRUM_CHAIN_ID });

  for (const [index, entry] of bundle.operations.entries()) {
    const signature = entry.signature;
    const scheme = entry.signatureScheme;
    if (!signature || !scheme) throw new OperationBundleError(`Operation ${index + 1} is missing signature data.`);

    let recovered: Address;
    try {
      recovered =
        scheme === "instant-layer"
          ? await recoverTypedDataAddress({
              domain: instantLayerDomain,
              types: SIGNED_OPERATION_TYPES,
              primaryType: "SignedOperation",
              message: {
                signer: entry.operation.signer,
                target: entry.operation.target,
                callData: entry.operation.callData,
                signerAccount: entry.operation.signerAccount,
                flexFields: entry.operation.flexFields,
                maxUses: entry.operation.maxUses,
                replayAttackHeader: entry.operation.replayAttackHeader,
              },
              signature,
            })
          : await recoverTypedDataAddress({
              domain: gaslessWalletDomain,
              types: GASLESS_WALLET_OPERATION_TYPES,
              primaryType: "SignedOperation",
              message: {
                signer: entry.operation.signer,
                target: entry.operation.target,
                callData: entry.operation.callData,
                signerAccount: entry.operation.signerAccount,
                replayAttackHeader: entry.operation.replayAttackHeader,
              },
              signature,
            });
    } catch {
      throw new OperationBundleError(`Operation ${index + 1} has an unreadable EIP-712 signature.`);
    }

    if (!isAddressEqual(recovered, entry.operation.signer)) {
      throw new OperationBundleError(`Operation ${index + 1} was not signed by its declared signer.`);
    }
  }
}

/** Convert a verified imported bundle to the exact variables the relay hook accepts. */
export function toRelayInstantOperationsVariables(bundle: PreparedOperationBundle): RelayInstantOperationsParameters {
  const readiness = getRelayReadinessIssues(bundle);
  if (readiness.length > 0) throw new OperationBundleError(readiness[0] ?? "Bundle is not relay-ready.");

  const operations: GaslessSignedOperationInput[] = bundle.operations.map((entry, index) => {
    if (!entry.signature) throw new OperationBundleError(`Operation ${index + 1} has no signature.`);
    return {
      operation: entry.operation,
      signature: entry.signature,
      fills: entry.fills,
      flexFillerSignatures: entry.flexFillerSignatures,
      walletId: entry.walletId,
    };
  });

  return {
    chainId: ARBITRUM_CHAIN_ID,
    operations,
    operationType: bundle.operationType!,
    userAddress: bundle.userAddress!,
    ...(bundle.accountId !== undefined ? { accountId: bundle.accountId } : {}),
    ...(bundle.templateId !== undefined ? { templateId: bundle.templateId } : {}),
    ...(bundle.idempotencyKey !== undefined ? { idempotencyKey: bundle.idempotencyKey } : {}),
    ...(bundle.metadata !== undefined ? { metadata: bundle.metadata } : {}),
  };
}

function parseOperationEntry(value: unknown, index: number): PreparedOperationEntry {
  const path = `bundle.operations[${index}]`;
  const entry = readRecord(value, path);
  assertOnlyKeys(entry, path, [
    "operation",
    "walletId",
    "signature",
    "signatureScheme",
    "fills",
    "flexFillerSignatures",
  ]);

  const operation = parseSignedOperation(entry.operation, `${path}.operation`);
  const walletId = entry.walletId === undefined ? 0n : readUint(entry.walletId, `${path}.walletId`);
  const signature = entry.signature === undefined ? undefined : readHex(entry.signature, `${path}.signature`, 65);
  const signatureScheme = readSignatureScheme(entry.signatureScheme, `${path}.signatureScheme`);
  const fills = readOptionalHexArray(entry.fills, `${path}.fills`);
  const flexFillerSignatures = readOptionalHexArray(entry.flexFillerSignatures, `${path}.flexFillerSignatures`, 65);

  if (fills.length !== flexFillerSignatures.length) {
    throw new OperationBundleError(`${path}.fills and flexFillerSignatures must have the same length.`);
  }

  return {
    operation,
    walletId,
    fills,
    flexFillerSignatures,
    ...(signature ? { signature } : {}),
    ...(signatureScheme ? { signatureScheme } : {}),
  };
}

function parseSignedOperation(value: unknown, path: string): SignedOperation {
  const operation = readRecord(value, path);
  assertOnlyKeys(operation, path, [
    "signer",
    "target",
    "callData",
    "signerAccount",
    "flexFields",
    "maxUses",
    "replayAttackHeader",
  ]);

  const signerAccount = readRecord(operation.signerAccount, `${path}.signerAccount`);
  assertOnlyKeys(signerAccount, `${path}.signerAccount`, ["addr", "isPartyB"]);

  const replayAttackHeader = readRecord(operation.replayAttackHeader, `${path}.replayAttackHeader`);
  assertOnlyKeys(replayAttackHeader, `${path}.replayAttackHeader`, ["nonce", "deadline", "salt"]);

  const flexFields = readArray(operation.flexFields, `${path}.flexFields`).map((field, index) => {
    const fieldPath = `${path}.flexFields[${index}]`;
    const record = readRecord(field, fieldPath);
    assertOnlyKeys(record, fieldPath, ["offset", "length", "authorizedFlexFiller"]);
    return {
      offset: readUint(record.offset, `${fieldPath}.offset`),
      length: readUint(record.length, `${fieldPath}.length`),
      authorizedFlexFiller: readAddress(record.authorizedFlexFiller, `${fieldPath}.authorizedFlexFiller`),
    };
  });

  return {
    signer: readAddress(operation.signer, `${path}.signer`),
    target: readAddress(operation.target, `${path}.target`),
    callData: readHex(operation.callData, `${path}.callData`),
    signerAccount: {
      addr: readAddress(signerAccount.addr, `${path}.signerAccount.addr`),
      isPartyB: readBoolean(signerAccount.isPartyB, `${path}.signerAccount.isPartyB`),
    },
    flexFields,
    maxUses: readUint(operation.maxUses, `${path}.maxUses`),
    replayAttackHeader: {
      nonce: readUint(replayAttackHeader.nonce, `${path}.replayAttackHeader.nonce`),
      deadline: readUint(replayAttackHeader.deadline, `${path}.replayAttackHeader.deadline`),
      salt: readHex(replayAttackHeader.salt, `${path}.replayAttackHeader.salt`, 32),
    },
  };
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new OperationBundleError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new OperationBundleError(`${path} must be an array.`);
  return value;
}

function readAddress(value: unknown, path: string): Address {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new OperationBundleError(`${path} must be a valid address.`);
  }
  return value;
}

function readOptionalAddress(value: unknown, path: string): Address | undefined {
  return value === undefined ? undefined : readAddress(value, path);
}

function readBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new OperationBundleError(`${path} must be true or false.`);
  return value;
}

function readUint(value: unknown, path: string): bigint {
  let parsed: bigint;
  if (typeof value === "string" && /^\d+$/.test(value)) parsed = BigInt(value);
  else if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) parsed = BigInt(value);
  else throw new OperationBundleError(`${path} must be a non-negative decimal string or safe integer.`);

  if (parsed > maxUint256) throw new OperationBundleError(`${path} exceeds uint256.`);
  return parsed;
}

function readSafeInteger(value: unknown, path: string): number {
  const parsed = readUint(value, path);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new OperationBundleError(`${path} exceeds a safe integer.`);
  return Number(parsed);
}

function readHex(value: unknown, path: string, bytes?: number): Hex {
  if (typeof value !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) {
    throw new OperationBundleError(`${path} must be byte-aligned 0x-prefixed hex.`);
  }
  const hex = value as Hex;
  if (bytes !== undefined && size(hex) !== bytes) {
    throw new OperationBundleError(`${path} must be exactly ${bytes} bytes.`);
  }
  return hex;
}

function readOptionalHexArray(value: unknown, path: string, bytes?: number): readonly Hex[] {
  if (value === undefined) return [];
  return readArray(value, path).map((entry, index) => readHex(entry, `${path}[${index}]`, bytes));
}

function readOptionalString(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new OperationBundleError(`${path} must be a string.`);
  return value;
}

function readOptionalBoundedString(value: unknown, path: string, maximum: number): string | undefined {
  const parsed = readOptionalString(value, path);
  if (parsed === undefined) return undefined;
  if (parsed.length === 0 || parsed.length > maximum) {
    throw new OperationBundleError(`${path} must contain 1–${maximum} characters.`);
  }
  return parsed;
}

function readSignatureScheme(value: unknown, path: string): OperationSignatureScheme | undefined {
  if (value === undefined) return undefined;
  if (value !== "instant-layer" && value !== "gasless-wallet") {
    throw new OperationBundleError(`${path} must be "instant-layer" or "gasless-wallet".`);
  }
  return value;
}

function assertOnlyKeys(record: Record<string, unknown>, path: string, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(record).find((key) => !allowedSet.has(key));
  if (unknown) throw new OperationBundleError(`${path}.${unknown} is not a supported field.`);
}
