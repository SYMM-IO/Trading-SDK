import type { Hash } from "viem";
import { describe, expect, it } from "vitest";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "./test/config";
import { getGaslessWriteRequest, registerGaslessWriteRequest } from "./write-request-registry";

function hash(seed: number): Hash {
  return `0x${seed.toString(16).padStart(2, "0").repeat(32)}` as Hash;
}

function entry(seed: number) {
  return {
    requestId: `req-${seed}`,
    service: "operations" as const,
    chainId: GASLESS_TEST_CHAIN,
    protocolInstance: TEST_GASLESS.protocolInstance ?? null,
    broadcastHash: hash(seed),
  };
}

describe("getGaslessWriteRequest", () => {
  it("resolves a registered broadcast hash back to its relay", () => {
    const { config } = gaslessTestConfig();
    registerGaslessWriteRequest(config, entry(1));

    expect(getGaslessWriteRequest(config, { hash: hash(1) })).toEqual(entry(1));
  });

  it("returns null for an ordinary wallet-submitted hash", () => {
    const { config } = gaslessTestConfig();

    expect(getGaslessWriteRequest(config, { hash: hash(9) })).toBeNull();
  });

  it("matches a hash whatever its casing", () => {
    const { config } = gaslessTestConfig();
    registerGaslessWriteRequest(config, entry(2));

    expect(getGaslessWriteRequest(config, { hash: hash(2).toUpperCase().replace("0X", "0x") as Hash })).not.toBeNull();
  });

  it("keeps one config's relays out of another's", () => {
    const { config } = gaslessTestConfig();
    const other = gaslessTestConfig().config;
    registerGaslessWriteRequest(config, entry(3));

    expect(getGaslessWriteRequest(other, { hash: hash(3) })).toBeNull();
  });

  it("stays bounded, dropping the oldest relays first", () => {
    const { config } = gaslessTestConfig();
    /** More than the retained window, so the first entries must have fallen out. */
    for (let seed = 1; seed <= 80; seed += 1) registerGaslessWriteRequest(config, entry(seed));

    expect(getGaslessWriteRequest(config, { hash: hash(1) })).toBeNull();
    expect(getGaslessWriteRequest(config, { hash: hash(80) })).not.toBeNull();
  });
});
