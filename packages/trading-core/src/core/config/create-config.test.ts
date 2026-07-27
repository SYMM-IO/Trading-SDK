import { zeroAddress, type Address, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { getChainConfig, getDefaultSolver, SymmioSupportedChainId } from "../chains";
import { createConfig } from "./create-config";

const HYPEREVM = SymmioSupportedChainId.HYPER_EVM;
const DEFAULT = getChainConfig(HYPEREVM);
const DEFAULT_SOLVER = getDefaultSolver(HYPEREVM);
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
    const config = createConfig({
      getClient: () => stubClient,
      symmioConfig: {
        [HYPEREVM]: {
          addresses: { affiliatesAddress: AFFILIATE, accountLayerAddress: customAccountLayer },
        },
      },
    });

    const merged = config.getChainConfig(HYPEREVM);
    expect(merged.addresses.accountLayerAddress).toBe(customAccountLayer);
    expect(merged.addresses.symmioAddress).toBe(DEFAULT.addresses.symmioAddress);
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

  describe("affiliate address (required per configured chain that can trade)", () => {
    it("requires the symmioConfig field at the type level", () => {
      // symmioConfig stays a required parameter — omitting it is a compile error.
      // At runtime nothing is configured, so the affiliate gate has no chain to check.
      // @ts-expect-error symmioConfig is required
      expect(() => createConfig({ getClient: () => stubClient })).not.toThrow();
    });

    it("throws when a configured chain with a solver omits its affiliate", () => {
      expect(() =>
        // @ts-expect-error affiliatesAddress is required by the type — this simulates a JS
        // consumer bypassing types; the runtime gate is the safety net.
        createConfig({ symmioConfig: { [HYPEREVM]: { addresses: {} } }, getClient: () => stubClient }),
      ).toThrow(SymmError);
    });

    it("allows an empty symmioConfig — nothing configured, registry defaults apply", () => {
      expect(() => createConfig({ symmioConfig: {}, getClient: () => stubClient })).not.toThrow();
    });

    it("allows the zero address (the on-chain contract is the real gate)", () => {
      const config = createConfig({
        symmioConfig: { [HYPEREVM]: { addresses: { affiliatesAddress: zeroAddress } } },
        getClient: () => stubClient,
      });
      expect(config.getChainConfig(HYPEREVM).addresses.affiliatesAddress).toBe(zeroAddress);
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

  describe("getSolver", () => {
    it("resolves the chain's default solver", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(config.getSolver({ chainId: HYPEREVM })).toMatchObject({
        kind: "enigma",
        url: DEFAULT_SOLVER.url,
        address: DEFAULT_SOLVER.address,
      });
      expect(config.getChainConfig(HYPEREVM).defaultSolverId).toBe("enigma");
    });

    it("resolves an explicit solverId", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(config.getSolver({ chainId: HYPEREVM, solverId: "enigma" }).url).toBe(DEFAULT_SOLVER.url);
    });

    it("throws UNKNOWN_SOLVER for an unconfigured solverId", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(() => config.getSolver({ chainId: HYPEREVM, solverId: "nope" })).toThrow(SymmError);
      expect(() => config.getSolver({ chainId: HYPEREVM, solverId: "nope" })).toThrow(/Unknown solver/);
    });

    it("deep-merges a per-chain solver override via symmioConfig", () => {
      const config = createConfig({
        symmioConfig: {
          [HYPEREVM]: {
            addresses: { affiliatesAddress: AFFILIATE },
            solvers: { enigma: { url: "https://custom.example/api" } },
          },
        },
        getClient: () => stubClient,
      });
      // Overridden field wins…
      expect(config.getSolver({ chainId: HYPEREVM }).url).toBe("https://custom.example/api");
      // …while un-overridden fields are inherited from the built-in solver.
      expect(config.getSolver({ chainId: HYPEREVM }).name).toBe(DEFAULT_SOLVER.name);
      expect(config.getSolver({ chainId: HYPEREVM }).address).toBe(DEFAULT_SOLVER.address);
    });
  });
});
