import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../core/chains";
import { getGaslessDeploymentKey } from "./deployment-key";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "./test/config";

const CHAIN = { chainId: GASLESS_TEST_CHAIN };

describe("getGaslessDeploymentKey", () => {
  it("is stable for one configuration", () => {
    const { config } = gaslessTestConfig();
    expect(getGaslessDeploymentKey(config, CHAIN)).toBe(getGaslessDeploymentKey(config, CHAIN));
    expect(getGaslessDeploymentKey(config, CHAIN)).toBe(getGaslessDeploymentKey(gaslessTestConfig().config, CHAIN));
  });

  it("differs between the operations and deposits services", () => {
    const { config } = gaslessTestConfig();
    expect(getGaslessDeploymentKey(config, CHAIN)).toBe(
      getGaslessDeploymentKey(config, { ...CHAIN, service: "operations" }),
    );
    expect(getGaslessDeploymentKey(config, { ...CHAIN, service: "deposits" })).not.toBe(
      getGaslessDeploymentKey(config, CHAIN),
    );
  });

  it.each([
    { label: "the service URL", overrides: { url: "https://other-gateway.test" } },
    { label: "the protocol instance", overrides: { protocolInstance: "arbitrum-42161-other" } },
    {
      label: "the GaslessLayer address",
      overrides: { gaslessLayerAddress: "0x00000000000000000000000000000000000000aa" },
    },
  ] as const)("changes with $label", ({ overrides }) => {
    const base = getGaslessDeploymentKey(gaslessTestConfig().config, CHAIN);
    expect(getGaslessDeploymentKey(gaslessTestConfig(overrides).config, CHAIN)).not.toBe(base);
  });

  it("ignores credentials, application headers and execution settings", () => {
    const base = getGaslessDeploymentKey(gaslessTestConfig().config, CHAIN);
    const other = gaslessTestConfig({
      apiKey: "another-key",
      getRequestHeaders: () => ({ Authorization: "Bearer session" }),
      execution: { mode: "gasless", fallback: "wallet" },
    }).config;
    expect(getGaslessDeploymentKey(other, CHAIN)).toBe(base);
  });

  it("throws the typed config error for a chain without gasless support", () => {
    const { config } = gaslessTestConfig();
    expect(() => getGaslessDeploymentKey(config, { chainId: SymmioSupportedChainId.BASE })).toThrow(
      expect.objectContaining({ code: expect.stringMatching(/^GASLESS_/) }),
    );
  });
});
