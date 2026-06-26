import { SymmioSupportedChainId, type CreateConfigParameters } from "@theoldvarorg/core";

/**
 * A named, one-click set of chain overrides surfaced in the config panel.
 */
export interface ConfigPreset {
  /** Stable identifier used as the apply-action value. */
  id: string;
  /** Short label shown on the action button. */
  label: string;
  /** One-line explanation of what applying the preset does. */
  description: string;
  /** Per-chain overrides this preset writes onto the SDK defaults. */
  overrides: CreateConfigParameters["chainOverrides"];
}

/**
 * Staging deployment overrides. Applying this points the SDK at the SYMMIO
 * staging contracts, the Enigma staging solver (partyB), the staging analytics
 * subgraph, and the staging notifications WebSocket on HyperEVM. The staging
 * collateral is an 18-decimal mintable test token.
 */
export const STAGING_CHAIN_OVERRIDES = {
  [SymmioSupportedChainId.HYPER_EVM]: {
    addresses: {
      symmioAddress: "0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB",
      instantLayerAddress: "0xCeE28784EFE6EEaf6da977D3F1d0cf05E62717eB",
      accountLayerAddress: "0x812e98F31A4EfFC09dD82e6e87ff7456151a0dFB",
      affiliatesAddress: "0x98490Efdd691ab58601302F98E1492DC28eCAA56",
      collateralAddress: "0x6aA554A167864027A02051D3F5C553244439B7Fd",
      collateralDecimals: 18,
    },
    solver: {
      name: "Enigma (staging)",
      address: "0xf62a670cda28FfAE65eE2a42D6cf6CF05EC5E775",
      url: "https://solver-staging.enigma.bz/api",
    },
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_analytics/latest/gn",
    },
    notifications: {
      url: "wss://notification-stage.rasa.capital/ws/v1/subscribe",
      channel: "Hyper-evm_Solver-lowcap_Stage",
    },
    priceService: {
      url: "https://lowcap-price-staging.enigma.bz",
      wsUrl: "wss://lowcap-price-staging.enigma.bz/ws",
    },
  },
} satisfies CreateConfigParameters["chainOverrides"];

/** The staging preset, ready to render as a one-click action in the config panel. */
export const STAGING_PRESET: ConfigPreset = {
  id: "staging",
  label: "Staging",
  description:
    "SYMMIO staging contracts, the Enigma staging solver, the staging notifications stream, and an 18-decimal test collateral.",
  overrides: STAGING_CHAIN_OVERRIDES,
};
