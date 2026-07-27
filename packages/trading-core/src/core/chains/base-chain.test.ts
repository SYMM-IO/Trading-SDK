import type { PublicClient } from "viem";
import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, listSupportedChains, SymmioSupportedChainId } from ".";
import { createConfig } from "../config/create-config";

const noopClient = () => ({}) as unknown as PublicClient;

describe("Base chain", () => {
  it("is a supported chain (8453)", () => {
    expect(listSupportedChains()).toContain(SymmioSupportedChainId.BASE);
    expect(SymmioSupportedChainId.BASE).toBe(8453);
  });

  it("ships its contract addresses + USDC collateral", () => {
    const base = getChainConfig(SymmioSupportedChainId.BASE);
    expect(base.addresses.symmioAddress).toBe("0x91Cf2D8Ed503EC52768999aA6D8DBeA6e52dbe43");
    expect(base.addresses.instantLayerAddress).toBe("0x0825435285ac0E5c02c7a7c443F631f3e07fE375");
    expect(base.addresses.accountLayerAddress).toBe("0x56caf00c6C5cB5478570Bb23807B9d1D697863DC");
    expect(base.addresses.collateralAddress).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(base.addresses.collateralDecimals).toBe(6);
  });

  it("registers the Rasa solver with its real endpoint, partyB, and kind", () => {
    const base = getChainConfig(SymmioSupportedChainId.BASE);
    expect(Object.keys(base.solvers)).toEqual(["rasa"]);
    expect(base.defaultSolverId).toBe("rasa");
    expect(base.solvers.rasa?.address).toBe("0x81631953E0C093e72935C1CAA4C7D519B2A0E407");
    expect(base.solvers.rasa?.url).toBe("https://stage-archon.rasa.capital");
    expect(base.solvers.rasa?.kind).toBe("rasa");
    // No COH confirmed on Base yet — absence marks TP/SL unsupported.
    expect(base.solvers.rasa?.tpsl).toBeUndefined();
  });

  it("carries placeholder service configs until Base's own are integrated", () => {
    // Services are HyperEVM placeholders for now — swapped out per service as Base
    // integrates its own. Present so the config type stays complete.
    const base = getChainConfig(SymmioSupportedChainId.BASE);
    expect(base.subgraphs).toBeDefined();
    expect(base.priceService).toBeDefined();
    expect(base.notifications).toBeDefined();
    expect(base.muon).toBeDefined();
  });

  it("does not force a Base affiliate on a consumer who only configures HyperEVM", () => {
    // Base has a solver now, but the affiliate gate only fires for chains the consumer
    // EXPLICITLY configures. A consumer that configures only HYPER_EVM is not forced to
    // supply a Base affiliate; Base falls back to its registry affiliate.
    expect(() =>
      createConfig({
        symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: zeroAddress } } },
        getClient: noopClient,
      }),
    ).not.toThrow();
  });

  it("getSolver on Base resolves the Rasa solver", () => {
    const config = createConfig({
      symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: zeroAddress } } },
      getClient: noopClient,
    });
    const solver = config.getSolver({ chainId: SymmioSupportedChainId.BASE });
    expect(solver.name).toBe("Rasa");
    expect(solver.kind).toBe("rasa");
  });

  it("getChainConfigKey on Base is defined and distinct from HyperEVM's", () => {
    const config = createConfig({
      symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: zeroAddress } } },
      getClient: noopClient,
    });
    expect(config.getChainConfigKey(SymmioSupportedChainId.BASE)).not.toBe("unsupported");
    expect(config.getChainConfigKey(SymmioSupportedChainId.BASE)).not.toBe(
      config.getChainConfigKey(SymmioSupportedChainId.HYPER_EVM),
    );
  });
});
