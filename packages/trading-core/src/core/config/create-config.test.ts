import { zeroAddress, type Address, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { getChainConfig, getDefaultSolver, SymmioSupportedChainId } from "../chains";
import { createConfig } from "./create-config";

const ARBITRUM = SymmioSupportedChainId.ARBITRUM;
const DEFAULT = getChainConfig(ARBITRUM);
const DEFAULT_SOLVER = getDefaultSolver(ARBITRUM);
const stubClient = {} as PublicClient;
const AFFILIATE: Address = "0x000000000000000000000000000000000000aFF1";
/** Minimal valid `symmioConfig`: the mandatory affiliate for the one supported chain. */
const SYMMIO = { [ARBITRUM]: { addresses: { affiliatesAddress: AFFILIATE } } };

describe("createConfig", () => {
  it("defaults to the first supported chain", () => {
    const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
    expect(config.defaultChainId).toBe(ARBITRUM);
    expect(config.chains).toContain(ARBITRUM);
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
        [ARBITRUM]: {
          addresses: { affiliatesAddress: AFFILIATE, accountLayerAddress: customAccountLayer },
        },
      },
    });

    const merged = config.getChainConfig(ARBITRUM);
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
    expect(getClient).toHaveBeenCalledWith({ chainId: ARBITRUM });
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
        createConfig({ symmioConfig: { [ARBITRUM]: { addresses: {} } }, getClient: () => stubClient }),
      ).toThrow(SymmError);
    });

    it("allows an empty symmioConfig — nothing configured, registry defaults apply", () => {
      expect(() => createConfig({ symmioConfig: {}, getClient: () => stubClient })).not.toThrow();
    });

    it("allows the zero address (the on-chain contract is the real gate)", () => {
      const config = createConfig({
        symmioConfig: { [ARBITRUM]: { addresses: { affiliatesAddress: zeroAddress } } },
        getClient: () => stubClient,
      });
      expect(config.getChainConfig(ARBITRUM).addresses.affiliatesAddress).toBe(zeroAddress);
    });

    it("applies the per-chain affiliate to the resolved chain config", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(config.getChainConfig(ARBITRUM).addresses.affiliatesAddress).toBe(AFFILIATE);
      // Never the built-in default.
      expect(config.getChainConfig(ARBITRUM).addresses.affiliatesAddress).not.toBe(DEFAULT.addresses.affiliatesAddress);
    });

    it("does not mutate the shared built-in chain defaults", () => {
      const before = getChainConfig(ARBITRUM).addresses.affiliatesAddress;
      createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(getChainConfig(ARBITRUM).addresses.affiliatesAddress).toBe(before);
    });
  });

  describe("getChainConfigKey", () => {
    it("is stable for identical config across separate instances", () => {
      const a = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      const b = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(a.getChainConfigKey(ARBITRUM)).toBe(b.getChainConfigKey(ARBITRUM));
    });

    it("changes when the affiliate changes", () => {
      const a = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      const b = createConfig({
        symmioConfig: {
          [ARBITRUM]: { addresses: { affiliatesAddress: "0x1234567890123456789012345678901234567890" } },
        },
        getClient: () => stubClient,
      });
      expect(a.getChainConfigKey(ARBITRUM)).not.toBe(b.getChainConfigKey(ARBITRUM));
    });

    it("changes when any field of the resolved chain config changes", () => {
      const base = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      const overridden = createConfig({
        getClient: () => stubClient,
        symmioConfig: {
          [ARBITRUM]: {
            addresses: {
              affiliatesAddress: AFFILIATE,
              collateralAddress: "0x9999999999999999999999999999999999999999",
            },
          },
        },
      });
      expect(overridden.getChainConfigKey(ARBITRUM)).not.toBe(base.getChainConfigKey(ARBITRUM));
    });

    it("returns a stable sentinel for an unsupported chain instead of throwing", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(() => config.getChainConfigKey(mainnet.id)).not.toThrow();
      expect(config.getChainConfigKey(mainnet.id)).toBe("unsupported");
    });

    it("uses the default chain when chainId is omitted", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(config.getChainConfigKey()).toBe(config.getChainConfigKey(ARBITRUM));
    });
  });

  describe("getSolver", () => {
    it("resolves the chain's default solver", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(config.getSolver({ chainId: ARBITRUM })).toMatchObject({
        id: "enigma",
        url: DEFAULT_SOLVER.url,
        address: DEFAULT_SOLVER.address,
      });
      expect(config.getChainConfig(ARBITRUM).defaultSolverId).toBe("enigma");
    });

    it("resolves an explicit solverId", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      expect(config.getSolver({ chainId: ARBITRUM, solverId: "enigma" }).url).toBe(DEFAULT_SOLVER.url);
    });

    it("throws UNKNOWN_SOLVER for a valid kind not registered on the chain", () => {
      const config = createConfig({ symmioConfig: SYMMIO, getClient: () => stubClient });
      // "rasa" is a valid kind, but Arbitrum only registers "enigma".
      expect(() => config.getSolver({ chainId: ARBITRUM, solverId: "rasa" })).toThrow(SymmError);
      expect(() => config.getSolver({ chainId: ARBITRUM, solverId: "rasa" })).toThrow(/Unknown solver/);
    });

    it("deep-merges a per-chain solver override via symmioConfig", () => {
      const config = createConfig({
        symmioConfig: {
          [ARBITRUM]: {
            addresses: { affiliatesAddress: AFFILIATE },
            solvers: { enigma: { url: "https://custom.example/api" } },
          },
        },
        getClient: () => stubClient,
      });
      // Overridden field wins…
      expect(config.getSolver({ chainId: ARBITRUM }).url).toBe("https://custom.example/api");
      // …while un-overridden fields are inherited from the built-in solver.
      expect(config.getSolver({ chainId: ARBITRUM }).name).toBe(DEFAULT_SOLVER.name);
      expect(config.getSolver({ chainId: ARBITRUM }).address).toBe(DEFAULT_SOLVER.address);
    });
  });
});
