import { describe, expect, it } from "vitest";
import { mockConfig } from "../shared/test/mock-config";
import { resolveExpressWithdrawService, supportsExpressWithdrawService } from "./resolve-express-withdraw";
import { createExpressConfig, TEST_PROVIDER } from "./test-fixtures";

describe("Express Withdraw service configuration", () => {
  it("resolves a configured v0.8.6 deployment", () => {
    const config = createExpressConfig();

    expect(resolveExpressWithdrawService(config)).toEqual({
      url: "https://express.test/v1/",
      providerAddress: TEST_PROVIDER,
    });
    expect(supportsExpressWithdrawService(config)).toBe(true);
  });

  it("reports absent configuration without throwing", () => {
    const { config } = mockConfig({ contractsVersion: "0.8.6" });

    expect(supportsExpressWithdrawService(config)).toBe(false);
    expect(() => resolveExpressWithdrawService(config)).toThrow(/EXPRESS_WITHDRAW_NOT_CONFIGURED|not configured/);
  });

  it("rejects the v0.8.5 contract surface even when service fields are present", () => {
    const configured = createExpressConfig({ contractsVersion: "0.8.5" });

    expect(supportsExpressWithdrawService(configured)).toBe(false);
    expect(() => resolveExpressWithdrawService(configured)).toThrow(/EXPRESS_WITHDRAW_UNSUPPORTED_CONTRACTS|0.8.6/);
  });
});
