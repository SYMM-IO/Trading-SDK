import { describe, expect, it } from "vitest";
import { normalizeExpressWithdrawOptions, normalizeExpressWithdrawStatus } from "./normalize";
import { createExpressOptionWire } from "./test-fixtures";

describe("Express Withdraw response normalization", () => {
  it("normalizes bigint fields and tolerates unknown additive fields", () => {
    const wire = {
      options: [{ ...createExpressOptionWire(), futureField: "ignored" }],
      requestDbId: 42,
      requestDbIds: { SAME_TX: 42 },
      futureTopLevelField: true,
    };
    const result = normalizeExpressWithdrawOptions(wire);

    expect(result.options[0]).toMatchObject({ nonce: 7n, expressAmount: 1_000_000n, optionTypeName: "SAME_TX" });
    expect(result.requestDbIds).toEqual({ SAME_TX: 42 });
  });

  it("rejects malformed booleans and mismatched option identifiers", () => {
    expect(() =>
      normalizeExpressWithdrawOptions({
        options: [createExpressOptionWire({ requiresValidators: "false" as unknown as boolean })],
        requestDbId: 42,
        requestDbIds: {},
      }),
    ).toThrow(/requiresValidators/);

    expect(() =>
      normalizeExpressWithdrawOptions({
        options: [createExpressOptionWire({ optionType: 2 })],
        requestDbId: 42,
        requestDbIds: {},
      }),
    ).toThrow(/optionType/);
  });

  it("normalizes status fee fields and rejects malformed local state", () => {
    const status = normalizeExpressWithdrawStatus({
      onChain: {
        status: "FINALIZED",
        optionType: "STANDARD",
        expressAmount: "1000000",
        acceptedAt: 10,
        finalizedAt: 20,
        cooldownEndTime: 30,
        maxAccelerationFee: "12",
        accelerationFee: "7",
      },
      local: {
        status: "NOT_FOUND",
        riskScore: null,
        riskChecked: false,
        lockTxHash: null,
        processTxHash: null,
        finalizeTxHash: null,
      },
    });

    expect(status.onChain.maxAccelerationFee).toBe(12n);
    expect(status.onChain.accelerationFee).toBe(7n);

    expect(() =>
      normalizeExpressWithdrawStatus({
        onChain: {
          status: "ACCEPTED",
          optionType: "SAME_TX",
          expressAmount: "1000000",
          acceptedAt: 10,
          finalizedAt: 0,
          cooldownEndTime: 30,
        },
        local: {
          status: "ACCEPTED",
          riskScore: null,
          riskChecked: "false" as unknown as boolean,
          lockTxHash: null,
          processTxHash: null,
          finalizeTxHash: null,
        },
      }),
    ).toThrow(/riskChecked/);
  });
});
