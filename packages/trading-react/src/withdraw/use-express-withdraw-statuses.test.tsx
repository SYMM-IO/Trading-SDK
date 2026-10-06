import { WithdrawStatus, type ExpressWithdrawStatus, type WithdrawRequest } from "@symmio/trading-core";
import type { Address } from "viem";
import { describe, expect, it, vi } from "vitest";

const useQueries = vi.hoisted(() =>
  vi.fn(({ queries }: { queries: unknown[] }) =>
    queries.map(() => ({ data: undefined, error: null, isLoading: true, isFetching: true })),
  ),
);

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQueries,
}));

import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useExpressWithdrawStatuses } from "./use-express-withdraw-statuses";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const RECEIVER = "0x2222222222222222222222222222222222222222" as const;
const PROVIDER = "0x573310D7b04fF21BB8628C69eE103dDF4922294A" as const;
const OTHER_PROVIDER = "0x3333333333333333333333333333333333333333" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

function request(id: bigint, provider: Address = ZERO_ADDRESS, partProvider: Address = ZERO_ADDRESS): WithdrawRequest {
  return {
    id,
    user: ACCOUNT,
    parts: [
      {
        id: 0n,
        amount: 1_000_000n,
        chainId: 42161n,
        receiver: RECEIVER,
        virtualProvider: ZERO_ADDRESS,
        expressProvider: partProvider,
      },
    ],
    timestamp: 1n,
    cooldownEndTime: 2n,
    status: WithdrawStatus.PENDING,
    speedUp: false,
    isCooldownModified: false,
    provider,
    isPureVirtual: false,
    providerData: "0x",
    totalAmount: 1_000_000n,
    totalVirtualAmount: 0n,
    advancedAmount: 0n,
  };
}

function status(onChainStatus: ExpressWithdrawStatus["onChain"]["status"]): ExpressWithdrawStatus {
  return {
    onChain: {
      status: onChainStatus,
      optionType: "STANDARD",
      expressAmount: 1n,
      acceptedAt: 0,
      finalizedAt: 0,
      cooldownEndTime: 0,
    },
    local: {
      status: "ACCEPTED",
      riskScore: null,
      riskChecked: false,
      lockTxHash: null,
      processTxHash: null,
      finalizeTxHash: null,
    },
  };
}

describe("useExpressWithdrawStatuses", () => {
  it("polls configured-provider requests and ignores classic or foreign-provider requests", () => {
    const { config } = createMockSymmioConfig({
      expressWithdraw: { url: "https://express.test/v1", providerAddress: PROVIDER },
    });
    const requests = [
      request(1n, PROVIDER),
      request(2n, ZERO_ADDRESS, PROVIDER),
      request(3n),
      request(4n, OTHER_PROVIDER),
    ];

    const { result } = renderHookWithProviders(() => useExpressWithdrawStatuses({ config, requests, enabled: false }));

    const queries = useQueries.mock.calls[0]?.[0].queries as Array<{
      enabled?: boolean;
      refetchInterval: (query: { state: { data?: ExpressWithdrawStatus } }) => number | false;
    }>;
    expect(queries).toHaveLength(2);
    expect(queries.every((query) => query.enabled === false)).toBe(true);
    expect(result.current.entries.map((entry) => entry.request.id)).toEqual([1n, 2n]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);

    expect(queries[0]?.refetchInterval({ state: { data: status("FINALIZED") } })).toBe(3_000);
    expect(queries[0]?.refetchInterval({ state: { data: status("PROCESSED") } })).toBe(false);
  });
});
