import type { ExpressWithdrawStatus } from "@symmio/trading-core";
import { describe, expect, it, vi } from "vitest";

const useQuery = vi.hoisted(() => vi.fn((options) => options));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery,
}));

import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useExpressWithdrawStatus } from "./use-express-withdraw-status";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const PROVIDER = "0x573310D7b04fF21BB8628C69eE103dDF4922294A" as const;

function status(
  optionType: ExpressWithdrawStatus["onChain"]["optionType"],
  onChainStatus: ExpressWithdrawStatus["onChain"]["status"],
  localStatus: ExpressWithdrawStatus["local"]["status"] = "ACCEPTED",
): ExpressWithdrawStatus {
  return {
    onChain: {
      status: onChainStatus,
      optionType,
      expressAmount: 1n,
      acceptedAt: 0,
      finalizedAt: 0,
      cooldownEndTime: 0,
    },
    local: {
      status: localStatus,
      riskScore: null,
      riskChecked: false,
      lockTxHash: null,
      processTxHash: null,
      finalizeTxHash: null,
    },
  };
}

describe("useExpressWithdrawStatus", () => {
  it("polls pending and NOT_FOUND states, keeps STANDARD FINALIZED pending, and stops at payout/failure", () => {
    const { config } = createMockSymmioConfig({
      expressWithdraw: { url: "https://express.test/v1", providerAddress: PROVIDER },
    });
    const parameters = {
      config,
      user: ACCOUNT,
      requestId: 7n,
      query: { enabled: false },
    } as const;

    renderHookWithProviders(() => useExpressWithdrawStatus(parameters));
    const options = useQuery.mock.calls[0]?.[0] as {
      refetchInterval?: (query: { state: { data?: ExpressWithdrawStatus } }) => number | false;
    };
    const interval = options.refetchInterval;
    expect(typeof interval).toBe("function");
    const getInterval = interval!;

    expect(getInterval({ state: { data: status("SAME_TX", "NONE", "NOT_FOUND") } })).toBe(3_000);

    expect(getInterval({ state: { data: status("STANDARD", "FINALIZED") } })).toBe(3_000);

    expect(getInterval({ state: { data: status("STANDARD", "PROCESSED") } })).toBe(false);

    expect(getInterval({ state: { data: status("SAME_TX", "SUSPENDED") } })).toBe(false);
  });
});
