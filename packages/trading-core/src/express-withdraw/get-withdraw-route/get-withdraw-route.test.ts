import { beforeEach, describe, expect, it, vi } from "vitest";

const getWithdrawableTime = vi.hoisted(() => vi.fn());
const getAccountBalanceOf = vi.hoisted(() => vi.fn());
const getExpressWithdrawOptions = vi.hoisted(() => vi.fn());

vi.mock("../../symmio-contracts/account-layer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../symmio-contracts/account-layer")>()),
  getAccountBalanceOf,
}));
vi.mock("../../symmio-contracts/symmio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../symmio-contracts/symmio")>()),
  getWithdrawableTime,
}));
vi.mock("../get-express-withdraw-options", () => ({ getExpressWithdrawOptions }));

import { SymmError } from "../../shared/errors/symm-error";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer";
import {
  createExpressConfig,
  createExpressOption,
  TEST_ACCOUNT,
  TEST_AMOUNT,
  TEST_AMOUNT_18,
  TEST_BLOCK_TIMESTAMP,
  TEST_RECEIVER,
} from "../test-fixtures";
import type { ExpressWithdrawRoutePolicy } from "../types";
import { getWithdrawRoute } from "./get-withdraw-route";

const BASE_PARAMETERS = {
  user: TEST_ACCOUNT,
  amount: TEST_AMOUNT,
  receiver: TEST_RECEIVER,
  isolationType: SubAccountIsolationType.MARKET,
} as const;

describe("getWithdrawRoute", () => {
  beforeEach(() => {
    getWithdrawableTime.mockReset();
    getAccountBalanceOf.mockReset();
    getExpressWithdrawOptions.mockReset();
    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP + 100n);
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT_18);
  });

  it.each<[string, ExpressWithdrawRoutePolicy]>([
    ["the default policy", {}],
    ["the classic fallback", { fallback: "classic" }],
    ["the strict fallback", { fallback: "error" }],
  ])("rejects a balance one unit short of the scaled amount under %s without requesting options", async (_, policy) => {
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT_18 - 1n);
    getExpressWithdrawOptions.mockRejectedValue(new SymmError("api", "SERVICE_DOWN", "down"));

    const rejection = await getWithdrawRoute(createExpressConfig(), { ...BASE_PARAMETERS, policy }).catch(
      (error: unknown) => error,
    );

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).toMatchObject({ kind: "validation", code: "WITHDRAW_INSUFFICIENT_BALANCE" });
    expect(getExpressWithdrawOptions).not.toHaveBeenCalled();
  });

  it("reads the balance in 18-decimal units, so a collateral-sized balance does not cover the amount", async () => {
    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP);
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT);

    await expect(getWithdrawRoute(createExpressConfig(), BASE_PARAMETERS)).rejects.toMatchObject({
      code: "WITHDRAW_INSUFFICIENT_BALANCE",
    });
    expect(getExpressWithdrawOptions).not.toHaveBeenCalled();
  });

  it("uses immediate classic withdrawal before contacting the service when the balance exactly covers the amount and cooldown is ready", async () => {
    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP);

    await expect(getWithdrawRoute(createExpressConfig(), BASE_PARAMETERS)).resolves.toEqual({
      kind: "classic",
      finalize: "immediate",
      reason: "cooldown-ready",
    });
    expect(getExpressWithdrawOptions).not.toHaveBeenCalled();
  });

  it("prefers SAME_TX then STANDARD and does not select WINDOWED by default", async () => {
    const standard = createExpressOption({ optionType: 2, optionTypeName: "STANDARD" });
    const windowed = createExpressOption({ optionType: 1, optionTypeName: "WINDOWED" });
    const sameTx = createExpressOption();
    getExpressWithdrawOptions.mockResolvedValue({
      options: [standard, windowed, sameTx],
      requestDbId: 1,
      requestDbIds: {},
    });

    await expect(getWithdrawRoute(createExpressConfig(), BASE_PARAMETERS)).resolves.toEqual({
      kind: "express",
      option: sameTx,
    });

    getExpressWithdrawOptions.mockResolvedValue({ options: [windowed, standard], requestDbId: 1, requestDbIds: {} });
    await expect(getWithdrawRoute(createExpressConfig(), BASE_PARAMETERS)).resolves.toEqual({
      kind: "express",
      option: standard,
    });

    getExpressWithdrawOptions.mockResolvedValue({ options: [windowed], requestDbId: 1, requestDbIds: {} });
    await expect(getWithdrawRoute(createExpressConfig(), BASE_PARAMETERS)).resolves.toEqual({
      kind: "classic",
      finalize: "after-cooldown",
      reason: "no-option",
    });
  });

  it("selects WINDOWED only through an explicit priority override", async () => {
    const windowed = createExpressOption({ optionType: 1, optionTypeName: "WINDOWED" });
    getExpressWithdrawOptions.mockResolvedValue({ options: [windowed], requestDbId: 1, requestDbIds: {} });

    await expect(
      getWithdrawRoute(createExpressConfig(), {
        ...BASE_PARAMETERS,
        policy: { optionPriority: ["WINDOWED"] },
      }),
    ).resolves.toEqual({ kind: "express", option: windowed });
  });

  it("falls back on service errors unless strict failure is requested", async () => {
    const serviceError = new SymmError("api", "SERVICE_DOWN", "down");
    getExpressWithdrawOptions.mockRejectedValue(serviceError);

    await expect(getWithdrawRoute(createExpressConfig(), BASE_PARAMETERS)).resolves.toEqual({
      kind: "classic",
      finalize: "after-cooldown",
      reason: "service-error",
    });
    await expect(
      getWithdrawRoute(createExpressConfig(), { ...BASE_PARAMETERS, policy: { fallback: "error" } }),
    ).rejects.toBe(serviceError);
  });

  it("keeps CUSTOM accounts on the classic deallocate path", async () => {
    await expect(
      getWithdrawRoute(createExpressConfig(), {
        ...BASE_PARAMETERS,
        isolationType: SubAccountIsolationType.CUSTOM,
      }),
    ).resolves.toEqual({
      kind: "classic",
      finalize: "after-cooldown",
      reason: "unsupported-account",
    });
    expect(getWithdrawableTime).not.toHaveBeenCalled();
    expect(getAccountBalanceOf).not.toHaveBeenCalled();
    expect(getExpressWithdrawOptions).not.toHaveBeenCalled();
  });
});
