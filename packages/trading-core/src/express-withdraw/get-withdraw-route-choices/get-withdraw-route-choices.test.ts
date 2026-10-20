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
import { getWithdrawRouteChoices } from "./get-withdraw-route-choices";

const BASE_PARAMETERS = {
  user: TEST_ACCOUNT,
  amount: TEST_AMOUNT,
  receiver: TEST_RECEIVER,
  isolationType: SubAccountIsolationType.MARKET,
} as const;

describe("getWithdrawRouteChoices", () => {
  beforeEach(() => {
    getWithdrawableTime.mockReset();
    getAccountBalanceOf.mockReset();
    getExpressWithdrawOptions.mockReset();
    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP + 100n);
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT_18);
  });

  it("keeps immediate Classic recommended while discovering every Express alternative once", async () => {
    const sameTx = createExpressOption();
    const windowed = createExpressOption({ optionType: 1, optionTypeName: "WINDOWED" });
    const standard = createExpressOption({ optionType: 2, optionTypeName: "STANDARD" });
    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP);
    getExpressWithdrawOptions.mockResolvedValue({
      options: [sameTx, windowed, standard],
      requestDbId: 1,
      requestDbIds: {},
    });

    await expect(getWithdrawRouteChoices(createExpressConfig(), BASE_PARAMETERS)).resolves.toEqual({
      recommended: { kind: "classic", finalize: "immediate", reason: "cooldown-ready" },
      available: [
        { kind: "classic", finalize: "immediate" },
        { kind: "express", option: sameTx },
        { kind: "express", option: windowed },
        { kind: "express", option: standard },
      ],
    });
    expect(getExpressWithdrawOptions).toHaveBeenCalledOnce();
  });

  it("preserves automatic priority while exposing options excluded from that priority", async () => {
    const windowed = createExpressOption({ optionType: 1, optionTypeName: "WINDOWED" });
    const standard = createExpressOption({ optionType: 2, optionTypeName: "STANDARD" });
    getExpressWithdrawOptions.mockResolvedValue({
      options: [windowed, standard],
      requestDbId: 1,
      requestDbIds: {},
    });

    await expect(getWithdrawRouteChoices(createExpressConfig(), BASE_PARAMETERS)).resolves.toEqual({
      recommended: { kind: "express", option: standard },
      available: [
        { kind: "classic", finalize: "after-cooldown" },
        { kind: "express", option: windowed },
        { kind: "express", option: standard },
      ],
    });
  });

  it("returns only Classic when option discovery fails under the default fallback", async () => {
    getExpressWithdrawOptions.mockRejectedValue(new Error("service unavailable"));

    await expect(getWithdrawRouteChoices(createExpressConfig(), BASE_PARAMETERS)).resolves.toEqual({
      recommended: { kind: "classic", finalize: "after-cooldown", reason: "service-error" },
      available: [{ kind: "classic", finalize: "after-cooldown" }],
    });
  });

  it("rejects an over-balance amount without requesting Express options", async () => {
    getWithdrawableTime.mockResolvedValue(TEST_BLOCK_TIMESTAMP);
    getAccountBalanceOf.mockResolvedValue(TEST_AMOUNT);

    const rejection = await getWithdrawRouteChoices(createExpressConfig(), BASE_PARAMETERS).catch(
      (error: unknown) => error,
    );

    expect(rejection).toBeInstanceOf(SymmError);
    expect(rejection).toMatchObject({ kind: "validation", code: "WITHDRAW_INSUFFICIENT_BALANCE" });
    expect(getExpressWithdrawOptions).not.toHaveBeenCalled();
  });

  it("keeps CUSTOM accounts Classic-only without reading balances or requesting options", async () => {
    await expect(
      getWithdrawRouteChoices(createExpressConfig(), {
        ...BASE_PARAMETERS,
        isolationType: SubAccountIsolationType.CUSTOM,
      }),
    ).resolves.toEqual({
      recommended: { kind: "classic", finalize: "after-cooldown", reason: "unsupported-account" },
      available: [{ kind: "classic", finalize: "after-cooldown" }],
    });
    expect(getWithdrawableTime).not.toHaveBeenCalled();
    expect(getAccountBalanceOf).not.toHaveBeenCalled();
    expect(getExpressWithdrawOptions).not.toHaveBeenCalled();
  });
});
