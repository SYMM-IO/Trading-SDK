import { expect, it } from "vitest";
import { getMarginAdjustmentPreviewQueryKey, type GetMarginAdjustmentPreviewParameters } from "../../index";

const address = "0x1111111111111111111111111111111111111111";
const parameters: GetMarginAdjustmentPreviewParameters & { configKey: string } = {
  chainId: 42161,
  owner: address,
  signer: address,
  subAccount: address,
  virtualAccount: address,
  direction: "add",
  amount: 1n,
  mark: { price: 2n, updatedAt: 1 },
  maxPriceAgeMs: 30_000,
  closeFeeReserveBufferBps: 10,
  configKey: "production",
};

it("exports serializable preview keys and isolates deployment, amount, mark and identity", () => {
  const key = getMarginAdjustmentPreviewQueryKey(parameters);
  expect(() => JSON.stringify(key)).not.toThrow();
  for (const patch of [
    { configKey: "staging" },
    { amount: 2n },
    { owner: "0x2222222222222222222222222222222222222222" as const },
    { mark: { price: 3n, updatedAt: 2 } },
  ]) {
    expect(getMarginAdjustmentPreviewQueryKey({ ...parameters, ...patch })).not.toEqual(key);
  }
});
