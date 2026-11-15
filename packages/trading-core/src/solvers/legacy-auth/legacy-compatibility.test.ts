import axios, { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockConfig, TEST_USER } from "../../shared/test/mock-config";
import {
  cancelLegacyConditionalOrder,
  createLegacyConditionalOrder,
  getLegacyCollateralLocked,
  getLegacyOrderHistory,
} from "../legacy-orders";
import { authenticateSolver, getSolverSignInMessage } from "./index";

const originalAdapter = axios.defaults.adapter;
const requests: Array<{ url?: string; baseURL?: string; data: unknown; authorization: unknown; signal: unknown }> = [];
let data: unknown;
const adapter: AxiosAdapter = async (config) => {
  requests.push({
    url: config.url,
    baseURL: config.baseURL,
    data: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
    authorization: config.headers.get("Authorization"),
    signal: config.signal,
  });
  return { data, status: 200, statusText: "OK", headers: {}, config };
};
beforeEach(() => {
  requests.length = 0;
  axios.defaults.adapter = adapter;
});
afterEach(() => {
  axios.defaults.adapter = originalAdapter;
});
const { config } = mockConfig();
const target = { chainId: 42161, solverId: "enigma" as const };

describe("legacy solver compatibility over the real HTTP boundary", () => {
  it("uses the owner nonce, subaccount statement, chosen lifetime and login wire fields", async () => {
    data = { nonce: "abcdefgh12345678" };
    const challenge = await getSolverSignInMessage(config, {
      ...target,
      owner: TEST_USER,
      account: "0x2222222222222222222222222222222222222222",
      domain: "example.com",
      issuedAt: "2026-11-15T00:00:00.000Z",
      expirationTime: "2027-11-15T00:00:00.000Z",
    });
    expect(requests[0]?.url).toBe(`/nonce/${TEST_USER}`);
    expect(challenge.message).toContain("msg: 0x2222222222222222222222222222222222222222");
    expect(challenge.message).toContain("Chain ID: 42161");
    data = { access_token: "test-token" };
    expect(
      await authenticateSolver(config, { ...target, challenge, signature: "test-signature", signType: "ERC4337" }),
    ).toEqual({ accessToken: "test-token" });
    expect(requests[1]?.data).toEqual({
      account_address: TEST_USER,
      expiration_time: challenge.expirationTime,
      issued_at: challenge.issuedAt,
      nonce: challenge.nonce,
      signature: "test-signature",
      sign_type: "ERC4337",
    });
    expect(requests[1]?.baseURL).toBe(requests[0]?.baseURL);
  });

  it("preserves history ordering, exact decimals and bearer authorization", async () => {
    const row = {
      id: "one",
      account: TEST_USER,
      symbol_id: 8,
      conditional_order_type: "send_quote",
      quantity: "0.000000000000000123",
      trigger_price: "1.23",
      side: "long",
      status: "cancelled",
      created_at: 10,
      executed_at: 12,
    };
    data = [row, { ...row, id: "two", executed_at: 11 }];
    const signal = new AbortController().signal;
    const history = await getLegacyOrderHistory(config, {
      ...target,
      account: TEST_USER,
      accessToken: "test-token",
      signal,
    });
    expect(history.map((item) => item.id)).toEqual(["one", "two"]);
    expect(history[0]).toMatchObject({ quantity: row.quantity, triggerPrice: "1.23", executedAt: 12 });
    expect(requests[0]).toMatchObject({
      url: `/orders/${TEST_USER}/history`,
      authorization: "Bearer test-token",
      signal,
    });
    expect(requests[0]?.baseURL).toMatch(/\/api\/v5$/);
  });

  it("retains create/cancel/collateral routes without leaking the token into the order body", async () => {
    data = {
      id: "id",
      created_at: 10,
      account: TEST_USER,
      symbol_id: 8,
      conditional_order_type: "send_quote",
      quantity: "2",
      trigger_price: "3",
      side: "long",
    };
    const auth = { ...target, accessToken: "test-token" };
    await createLegacyConditionalOrder(config, {
      ...auth,
      order: {
        account: TEST_USER,
        symbolId: 8,
        conditionalOrderType: "send_quote",
        quantity: "2",
        triggerPrice: "3",
        side: "long",
      },
    });
    expect(requests[0]?.data).toEqual({
      account: TEST_USER,
      symbol_id: 8,
      conditional_order_type: "send_quote",
      quantity: "2",
      trigger_price: "3",
      side: "long",
    });
    data = undefined;
    expect(await cancelLegacyConditionalOrder(config, { ...auth, orderId: "id/1" })).toBe(true);
    expect(requests[1]?.url).toBe("/orders/id%2F1");
    data = { collateral_locked: "0.123456789123456789" };
    expect(await getLegacyCollateralLocked(config, { ...auth, account: TEST_USER })).toBe("0.123456789123456789");
  });

  it("rejects HTTP failures and unsupported solvers instead of returning empty history", async () => {
    axios.defaults.adapter = async (request) => {
      throw new AxiosError("unauthorized", "ERR_BAD_REQUEST", request, undefined, {
        data: { error_message: "expired" },
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config: request,
      });
    };
    await expect(
      getLegacyOrderHistory(config, { ...target, account: TEST_USER, accessToken: "expired" }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      getLegacyOrderHistory(config, { chainId: 8453, solverId: "rasa", account: TEST_USER, accessToken: "expired" }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_BY_SOLVER" });
  });
});
