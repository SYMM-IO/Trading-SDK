import { describe, expect, it } from "vitest";
import { ListingDepositChainId } from "../types";
import { toPoolRewardPoint, toUserPoolRewardChart } from "./to-pool-reward-point";

describe("toPoolRewardPoint", () => {
  it("parses the 18-decimal reward string without losing precision", () => {
    expect(toPoolRewardPoint({ timestamp: 1_752_364_800, reward: "5500000000000000" })).toEqual({
      timestamp: 1_752_364_800,
      reward: 5500000000000000n,
    });
  });

  it("collapses an absent or unparseable reward to zero rather than null", () => {
    expect(toPoolRewardPoint({ timestamp: 1, reward: null }).reward).toBe(0n);
    expect(toPoolRewardPoint({ timestamp: 1, reward: "" }).reward).toBe(0n);
    expect(toPoolRewardPoint({ timestamp: 1, reward: "not-a-number" }).reward).toBe(0n);
  });
});

describe("toUserPoolRewardChart", () => {
  it("surfaces the wire chain_id as the market's own chain and maps every point", () => {
    expect(
      toUserPoolRewardChart({
        market_address: "0xdead",
        chain_id: ListingDepositChainId.BASE,
        rewards: [{ timestamp: 1, reward: "1000000000000000000" }],
      }),
    ).toEqual({
      marketAddress: "0xdead",
      marketChainId: ListingDepositChainId.BASE,
      rewards: [{ timestamp: 1, reward: 1000000000000000000n }],
    });
  });

  it("returns an empty series when the group carries no rewards", () => {
    expect(
      toUserPoolRewardChart({
        market_address: "0xdead",
        chain_id: ListingDepositChainId.BASE,
        rewards: undefined as unknown as [],
      }).rewards,
    ).toEqual([]);
  });
});
