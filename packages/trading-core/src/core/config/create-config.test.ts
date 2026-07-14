import { zeroAddress, type Address, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { getChainConfig, SymmioSupportedChainId } from "../chains";
import { createConfig } from "./create-config";

const HYPEREVM = SymmioSupportedChainId.HYPER_EVM;
const DEFAULT = getChainConfig(HYPEREVM);
const stubClient = {} as PublicClient;
const AFFILIATE: Address = "0x000000000000000000000000000000000000aFF1";
/** Minimal valid `symmioConfig`: the mandatory affiliate for the one supported chain. */
const SYMMIO = { [HYPEREVM]: { addresses: { affiliatesAddress: AFFILIATE } } };

describe("createConfig", () => {
  it("defaults to the first supported chain", () => {
    const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
    expect(config.defaultChainId).toBe(HYPEREVM);
    expect(config.chains).toContain(HYPEREVM);
  });

  it("getChainConfig returns built-in defaults", () => {
    const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
    expect(config.getChainConfig().addresses.accountLayerAddress).toBe(DEFAULT.addresses.accountLayerAddress);
  });

  it("deep-merges per-chain config onto defaults", () => {
    const customAccountLayer = "0x9999999999999999999999999999999999999999" as const;
    const customSolverUrl = "https://custom-solver.example.com/api";
    const config = createConfig({
      getClient: () => stubClient,
      symmioConfig: {
        [HYPEREVM]: {
          addresses: { affiliatesAddress: AFFILIATE, accountLayerAddress: customAccountLayer },
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
    const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
    expect(() => config.getChainConfig(mainnet.id)).toThrow(SymmError);
  });

  it("getClient applies the default chain when chainId is omitted", () => {
    const getClient = vi.fn(() => stubClient);
    const config = createConfig({ symmioConfig: SYMMIO, getClient });
    config.getClient();
    expect(getClient).toHaveBeenCalledWith({ chainId: HYPEREVM });
  });

  it("getWalletClient throws when no resolver is provided", async () => {
    const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
    await expect(config.getWalletClient()).rejects.toThrow(SymmError);
  });

  it("defaults simulateBeforeWrite to true", () => {
    const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
    expect(config.simulateBeforeWrite).toBe(true);
  });

  it("honors an explicit simulateBeforeWrite override", () => {
    const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient, simulateBeforeWrite: false });
    expect(config.simulateBeforeWrite).toBe(false);
  });

  describe("affiliate address (mandatory, per chain)", () => {
    it("requires the symmioConfig field", () => {
      // @ts-expect-error symmioConfig is required
      expect(() => createConfig({ getClient: () => stubClient })).toThrow(SymmError);
    });

    it("throws when a supported chain has no affiliate entry", () => {
      expect(() => createConfig({ symmioConfig: {}, getClient: () => stubClient })).toThrow(SymmError);
    });

    it("throws on the zero address", () => {
      expect(() =>
        createConfig({
          symmioConfig: { [HYPEREVM]: { addresses: { affiliatesAddress: zeroAddress } } },
          getClient: () => stubClient,
        }),
      ).toThrow(SymmError);
    });

    it("applies the per-chain affiliate to the resolved chain config", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(config.getChainConfig(HYPEREVM).addresses.affiliatesAddress).toBe(AFFILIATE);
      // Never the built-in default.
      expect(config.getChainConfig(HYPEREVM).addresses.affiliatesAddress).not.toBe(DEFAULT.addresses.affiliatesAddress);
    });

    it("does not mutate the shared built-in chain defaults", () => {
      const before = getChainConfig(HYPEREVM).addresses.affiliatesAddress;
      createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(getChainConfig(HYPEREVM).addresses.affiliatesAddress).toBe(before);
    });
  });

  describe("getChainConfigKey", () => {
    it("is stable for identical config across separate instances", () => {
      const a = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      const b = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(a.getChainConfigKey(HYPEREVM)).toBe(b.getChainConfigKey(HYPEREVM));
    });

    it("changes when the affiliate changes", () => {
      const a = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      const b = createConfig({
        symmioConfig: {
          [HYPEREVM]: { addresses: { affiliatesAddress: "0x1234567890123456789012345678901234567890" } },
        },
        getClient: () => stubClient,
      });
      expect(a.getChainConfigKey(HYPEREVM)).not.toBe(b.getChainConfigKey(HYPEREVM));
    });

    it("changes when any field of the resolved chain config changes", () => {
      const base = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      const overridden = createConfig({
        getClient: () => stubClient,
        symmioConfig: {
          [HYPEREVM]: {
            addresses: {
              affiliatesAddress: AFFILIATE,
              collateralAddress: "0x9999999999999999999999999999999999999999",
            },
          },
        },
      });
      expect(overridden.getChainConfigKey(HYPEREVM)).not.toBe(base.getChainConfigKey(HYPEREVM));
    });

    it("returns a stable sentinel for an unsupported chain instead of throwing", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(() => config.getChainConfigKey(mainnet.id)).not.toThrow();
      expect(config.getChainConfigKey(mainnet.id)).toBe("unsupported");
    });

    it("uses the default chain when chainId is omitted", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(config.getChainConfigKey()).toBe(config.getChainConfigKey(HYPEREVM));
    });
  });
});
