import type { PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { getChainConfig, SymmioSupportedChainId } from "../chains";
import { createConfig } from "./create-config";

const HYPEREVM = SymmioSupportedChainId.HYPER_EVM;
const DEFAULT = getChainConfig(HYPEREVM);
const stubClient = {} as PublicClient;

describe("createConfig", () => {
  it("defaults to the first supported chain", () => {
    const config = createConfig({ getClient: () => stubClient });
    expect(config.defaultChainId).toBe(HYPEREVM);
    expect(config.chains).toContain(HYPEREVM);
  });

  it("getChainConfig returns built-in defaults", () => {
    const config = createConfig({ getClient: () => stubClient });
    expect(config.getChainConfig().addresses.accountLayerAddress).toBe(DEFAULT.addresses.accountLayerAddress);
  });

  it("deep-merges per-chain overrides onto defaults", () => {
    const customAccountLayer = "0x9999999999999999999999999999999999999999" as const;
    const customSolverUrl = "https://custom-solver.example.com/api";
    const config = createConfig({
      getClient: () => stubClient,
      chainOverrides: {
        [HYPEREVM]: {
          addresses: { accountLayerAddress: customAccountLayer },
          solver: { url: customSolverUrl },
        },
      },
    });

    const merged = config.getChainConfig(HYPEREVM);
    expect(merged.addresses.accountLayerAddress).toBe(customAccountLayer);
    expect(merged.addresses.symmioAddress).toBe(DEFAULT.addresses.symmioAddress);
    expect(merged.solver.url).toBe(customSolverUrl);
    expect(merged.solver.name).toBe(DEFAULT.solver.name);
  });

  it("getChainConfig throws for an unsupported chain", () => {
    const config = createConfig({ getClient: () => stubClient });
    expect(() => config.getChainConfig(mainnet.id)).toThrow(SymmError);
  });

  it("getClient applies the default chain when chainId is omitted", () => {
    const getClient = vi.fn(() => stubClient);
    const config = createConfig({ getClient });
    config.getClient();
    expect(getClient).toHaveBeenCalledWith({ chainId: HYPEREVM });
  });

  it("getWalletClient throws when no resolver is provided", async () => {
    const config = createConfig({ getClient: () => stubClient });
    await expect(config.getWalletClient()).rejects.toThrow(SymmError);
  });

  describe("getChainConfigKey", () => {
    it("is stable for identical config across separate instances", () => {
      const a = createConfig({ getClient: () => stubClient });
      const b = createConfig({ getClient: () => stubClient });
      expect(a.getChainConfigKey(HYPEREVM)).toBe(b.getChainConfigKey(HYPEREVM));
    });

    it("changes when any field of the resolved chain config changes", () => {
      const base = createConfig({ getClient: () => stubClient });
      const overridden = createConfig({
        getClient: () => stubClient,
        chainOverrides: {
          [HYPEREVM]: { addresses: { collateralAddress: "0x9999999999999999999999999999999999999999" } },
        },
      });
      expect(overridden.getChainConfigKey(HYPEREVM)).not.toBe(base.getChainConfigKey(HYPEREVM));
    });

    it("returns a stable sentinel for an unsupported chain instead of throwing", () => {
      const config = createConfig({ getClient: () => stubClient });
      expect(() => config.getChainConfigKey(mainnet.id)).not.toThrow();
      expect(config.getChainConfigKey(mainnet.id)).toBe("unsupported");
    });

    it("uses the default chain when chainId is omitted", () => {
      const config = createConfig({ getClient: () => stubClient });
      expect(config.getChainConfigKey()).toBe(config.getChainConfigKey(HYPEREVM));
    });
  });
});
