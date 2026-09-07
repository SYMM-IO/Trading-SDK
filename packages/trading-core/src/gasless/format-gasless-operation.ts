import { SymmError } from "../shared/errors/symm-error";
import type { SignedOperation } from "../solvers/instant-open/shared/types";
import type { GaslessWireSignedOperation } from "./wire-types";

/**
 * Convert a `bigint` field to the JSON **number** the GaslessQ wire format
 * requires, refusing values outside the safe-integer range.
 *
 * The service schema types `nonce`, `deadline`, `maxUses`, and flex-field
 * offsets as integers — decimal strings are rejected. Every value the SDK puts
 * in these fields (sequential nonces, unix-second deadlines, `maxUses: 1`,
 * calldata byte offsets) fits comfortably below `2^53`; anything larger is a
 * bug worth failing loudly on rather than silently truncating.
 *
 * @throws {SymmError} `GASLESS_VALUE_UNSAFE` outside `[0, Number.MAX_SAFE_INTEGER]`.
 *
 * @internal
 */
export function toGaslessSafeNumber(value: bigint, field: string): number {
  const asNumber = Number(value);
  if (!Number.isSafeInteger(asNumber) || asNumber < 0) {
    throw new SymmError(
      "validation",
      "GASLESS_VALUE_UNSAFE",
      `Gasless: ${field} (${value}) is outside the JSON safe-integer range the relay accepts.`,
    );
  }
  return asNumber;
}

/**
 * Serialize a signed InstantLayer operation into the GaslessQ wire shape.
 *
 * Deliberately **not** the solver-flow `formatSignedOperationPayload` — the
 * two wire contracts are maintained by different services and must be able to
 * drift independently. Semantics match: every `uint256` becomes a guarded
 * JSON number.
 *
 * @param operation - The struct that was EIP-712 signed.
 * @returns The wire-shaped operation for a `relay-instant` body.
 *
 * @internal
 */
export function formatGaslessOperation(operation: SignedOperation): GaslessWireSignedOperation {
  return {
    signer: operation.signer,
    target: operation.target,
    callData: operation.callData,
    signerAccount: {
      addr: operation.signerAccount.addr,
      isPartyB: operation.signerAccount.isPartyB,
    },
    flexFields: operation.flexFields.map((field) => ({
      offset: toGaslessSafeNumber(field.offset, "flexFields.offset"),
      length: toGaslessSafeNumber(field.length, "flexFields.length"),
      authorizedFlexFiller: field.authorizedFlexFiller,
    })),
    maxUses: toGaslessSafeNumber(operation.maxUses, "maxUses"),
    replayAttackHeader: {
      nonce: toGaslessSafeNumber(operation.replayAttackHeader.nonce, "replayAttackHeader.nonce"),
      deadline: toGaslessSafeNumber(operation.replayAttackHeader.deadline, "replayAttackHeader.deadline"),
      salt: operation.replayAttackHeader.salt,
    },
  };
}
