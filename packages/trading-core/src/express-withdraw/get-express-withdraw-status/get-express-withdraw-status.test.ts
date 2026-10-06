import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createExpressConfig, TEST_ACCOUNT } from "../test-fixtures";
import { getExpressWithdrawStatus } from "./get-express-withdraw-status";

describe("getExpressWithdrawStatus", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gets the exact user/request path and normalizes additive acceleration fields", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        code: "ok",
        onChain: {
          status: "FINALIZED",
          optionType: "STANDARD",
          expressAmount: "1000000",
          acceptedAt: 10,
          finalizedAt: 20,
          cooldownEndTime: 30,
          maxAccelerationFee: "9",
          accelerationFee: "4",
          futureField: "ignored",
        },
        local: {
          status: "NOT_FOUND",
          riskScore: null,
          riskChecked: false,
          lockTxHash: null,
          processTxHash: null,
          finalizeTxHash: null,
        },
      },
    });
    const signal = new AbortController().signal;

    const result = await getExpressWithdrawStatus(createExpressConfig(), {
      user: TEST_ACCOUNT,
      requestId: 17n,
      signal,
    });

    expect(get).toHaveBeenCalledWith(`/status/${TEST_ACCOUNT}/17`, {
      baseURL: "https://express.test/v1/",
      signal,
    });
    expect(result.onChain).toMatchObject({
      optionType: "STANDARD",
      expressAmount: 1_000_000n,
      maxAccelerationFee: 9n,
      accelerationFee: 4n,
    });
  });
});
