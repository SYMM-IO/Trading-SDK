import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { buildSignedOperation, formatSignedOperationPayload } from "./operations";
import type { FlexField } from "./types";

const SIGNER: Address = "0x1111111111111111111111111111111111111111";
const TARGET: Address = "0x2222222222222222222222222222222222222222";
const SUB_ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const SOLVER: Address = "0x4444444444444444444444444444444444444444";
const SALT: Hex = `0x${"ab".repeat(32)}`;
const CALL_DATA: Hex = "0xdeadbeef";
const DEADLINE = 1_700_000_300n;

const BASE = {
  signer: SIGNER,
  target: TARGET,
  callData: CALL_DATA,
  signerAccount: SUB_ACCOUNT,
  deadline: DEADLINE,
  salt: SALT,
};

const FLEX_FIELD: FlexField = { offset: 512n, length: 352n, authorizedFlexFiller: SOLVER };

describe("buildSignedOperation", () => {
  it("defaults to a fully fixed, single-use operation", () => {
    const operation = buildSignedOperation(BASE);

    expect(operation.flexFields).toEqual([]);
    expect(operation.maxUses).toBe(1n);
    expect(operation.signerAccount).toEqual({ addr: SUB_ACCOUNT, isPartyB: false });
    expect(operation.replayAttackHeader).toEqual({ nonce: 0n, deadline: DEADLINE, salt: SALT });
  });

  it("carries through a delegated calldata region", () => {
    const operation = buildSignedOperation({ ...BASE, flexFields: [FLEX_FIELD] });

    expect(operation.flexFields).toEqual([FLEX_FIELD]);
  });

  it("copies flexFields so the caller's array cannot mutate the operation", () => {
    const fields: FlexField[] = [FLEX_FIELD];

    const operation = buildSignedOperation({ ...BASE, flexFields: fields });
    fields.push({ ...FLEX_FIELD, offset: 0n });

    expect(operation.flexFields).toHaveLength(1);
  });

  it("carries through an explicit maxUses", () => {
    expect(buildSignedOperation({ ...BASE, maxUses: 0n }).maxUses).toBe(0n);
  });
});

describe("formatSignedOperationPayload", () => {
  it("serializes flexFields to the numeric wire shape", () => {
    const operation = buildSignedOperation({ ...BASE, flexFields: [FLEX_FIELD] });

    const payload = formatSignedOperationPayload(operation);

    expect(payload.flexFields).toEqual([{ offset: 512, length: 352, authorizedFlexFiller: SOLVER }]);
    expect(payload.maxUses).toBe(1);
  });

  it("serializes an empty flexFields list", () => {
    const payload = formatSignedOperationPayload(buildSignedOperation(BASE));

    expect(payload.flexFields).toEqual([]);
  });
});
