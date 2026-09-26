import type { PublicClient } from "viem";
import { expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { PositionType } from "../../../symmio-contracts/symmio/types";

const getInstantOpenFees = vi.hoisted(() => vi.fn());
vi.mock("./get-instant-open-fees", () => ({ getInstantOpenFees }));

import { getInstantOpenFeesQueryOptions } from "./query";

it("forwards the balance budget from the fee query to its action", async () => {
  const account = "0x0000000000000000000000000000000000005Ab1";
  const config = createConfig({
    getClient: () => ({}) as PublicClient,
    symmioConfig: { [SymmioSupportedChainId.BASE]: { addresses: { affiliatesAddress: account } } },
  });
  const inputs = {
    chainId: SymmioSupportedChainId.BASE,
    subAccountAddress: account,
    market: { id: 1 },
    positionType: PositionType.LONG,
    initialMargin: "100",
    availableBalance: "100",
    leverage: 2,
    slippage: 1,
    estimatedOpenPrice: null,
  } as const;
  const result = { fundingMode: "full-balance", quantity: "1.9" };
  getInstantOpenFees.mockResolvedValue(result);
  const query = getInstantOpenFeesQueryOptions(config, { ...inputs, query: { retry: false } });
  expect(await query.queryFn()).toBe(result);
  expect(getInstantOpenFees).toHaveBeenCalledWith(config, inputs);
});
