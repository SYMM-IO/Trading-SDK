import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";

const getInstantCloseFees = vi.hoisted(() => vi.fn());
vi.mock("./get-instant-close-fees", () => ({ getInstantCloseFees }));

import { getInstantCloseFeesQueryKey, getInstantCloseFeesQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { [BASE]: { addresses: { affiliatesAddress: AFFILIATE } } },
});

const PARAMS = {
  chainId: BASE,
  subAccountAddress: "0x0000000000000000000000000000000000005Ab1",
  market: { id: 1 },
  quantity: "2.5",
  openedAt: 1_700_000_000,
} as const;

describe("getInstantCloseFeesQueryOptions", () => {
  it("is disabled until a quantity exists", () => {
    expect(getInstantCloseFeesQueryOptions(config, { ...PARAMS, quantity: "" }).enabled).toBe(false);
    expect(getInstantCloseFeesQueryOptions(config, PARAMS).enabled).toBe(true);
  });

  it("folds the config key into the query key and drops the TanStack query field", () => {
    const key = getInstantCloseFeesQueryKey({ ...PARAMS, configKey: config.getChainConfigKey(BASE) });

    expect(key[0]).toBe("getInstantCloseFees");
    expect(key[1]).not.toHaveProperty("query");
    expect(key[1]).toMatchObject({ quantity: "2.5", openedAt: 1_700_000_000 });
  });

  it("queryFn forwards the params (without the query field) to getInstantCloseFees", async () => {
    getInstantCloseFees.mockResolvedValue({ kind: "rasa" });
    const options = getInstantCloseFeesQueryOptions(config, { ...PARAMS, query: { staleTime: 1 } });

    await (options.queryFn as () => Promise<unknown>)();

    expect(getInstantCloseFees).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        quantity: "2.5",
        openedAt: 1_700_000_000,
        subAccountAddress: PARAMS.subAccountAddress,
      }),
    );
    expect(getInstantCloseFees.mock.calls[0]?.[1]).not.toHaveProperty("query");
  });
});
