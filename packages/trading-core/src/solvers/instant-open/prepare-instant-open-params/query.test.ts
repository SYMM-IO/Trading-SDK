import type { PublicClient } from "viem";
import { describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { PositionType } from "../../../symmio-contracts/symmio/types";

const prepareInstantOpenParams = vi.hoisted(() => vi.fn());
vi.mock("./prepare-instant-open-params", () => ({ prepareInstantOpenParams }));

import { getPrepareInstantOpenParamsQueryKey, prepareInstantOpenParamsQueryOptions } from "./query";

const BASE = SymmioSupportedChainId.BASE;
const AFFILIATE = "0x000000000000000000000000000000000000aFF1";
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { [BASE]: { addresses: { affiliatesAddress: AFFILIATE } } },
});

const PARAMS = {
  chainId: BASE,
  from: "0x000000000000000000000000000000000000f200",
  subAccountAddress: "0x0000000000000000000000000000000000005Ab1",
  market: { id: 1 },
  positionType: PositionType.LONG,
  leverage: 2,
  slippage: 1,
} as const;

describe("prepareInstantOpenParamsQueryOptions", () => {
  it("is disabled until a funding source exists", () => {
    expect(prepareInstantOpenParamsQueryOptions(config, PARAMS).enabled).toBe(false);
    expect(prepareInstantOpenParamsQueryOptions(config, { ...PARAMS, initialMargin: "" }).enabled).toBe(false);
    expect(prepareInstantOpenParamsQueryOptions(config, { ...PARAMS, initialMargin: "100" }).enabled).toBe(true);
    expect(
      prepareInstantOpenParamsQueryOptions(config, { ...PARAMS, fund: { mode: "full-balance", balance: "100" } })
        .enabled,
    ).toBe(true);
  });

  it("folds the config key into the query key and drops the TanStack query field", () => {
    const key = getPrepareInstantOpenParamsQueryKey({
      ...PARAMS,
      initialMargin: "100",
      configKey: config.getChainConfigKey(BASE),
    });
    expect(key[0]).toBe("prepareInstantOpenParams");
    expect(key[1]).not.toHaveProperty("query");
    expect(key[1]).toMatchObject({ initialMargin: "100", leverage: 2 });
  });

  it("queryFn forwards the params (without the query field) to prepareInstantOpenParams", async () => {
    prepareInstantOpenParams.mockResolvedValue({ order: {} });
    const options = prepareInstantOpenParamsQueryOptions(config, {
      ...PARAMS,
      initialMargin: "100",
      query: { staleTime: 1 },
    });

    await (options.queryFn as () => Promise<unknown>)();

    expect(prepareInstantOpenParams).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ initialMargin: "100", leverage: 2, from: PARAMS.from }),
    );
    expect(prepareInstantOpenParams.mock.calls[0]?.[1]).not.toHaveProperty("query");
  });
});
