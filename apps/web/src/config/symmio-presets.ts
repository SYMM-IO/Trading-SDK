import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";

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
  overrides: CreateConfigParameters["symmioConfig"];
}

/**
 * Staging deployment overrides. Applying this points the SDK at the SYMMIO
 * Arbitrum staging contracts, the Enigma staging solver (partyB), the staging
 * subgraphs, and the staging notifications WebSocket.
 */
export const STAGING_CHAIN_OVERRIDES = {
  [SymmioSupportedChainId.ARBITRUM]: {
    contractsVersion: "0.8.6",
    addresses: {
      symmioAddress: "0x573310dB6d160B26026B8706EBe9831c7dEF1D09",
      instantLayerAddress: "0x2C9e944cB71329fC659Da50A10a79a508Dd49ba5",
      accountLayerAddress: "0x5733107211B2801Acd39933a54d482FE303c4907",
      affiliatesAddress: "0xe99c18CF3C62B9229f9251fd2562077a33e7600a",
      collateralAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      collateralDecimals: 6,
    },
    solvers: {
      enigma: {
        name: "Enigma (staging)",
        address: "0x9be79D4977D86D440F9e1Ea0d468A58104B9b932",
        url: "https://arb-staging.enigma.bz/api",
        tpsl: {
          url: "https://conditional-orders-handler-lowcap85.rasa.capital",
          wsUrl: "wss://notification.rasa.capital/ws/v1/subscribe",
          appName: "Arbitrum_COH_Production",
          cohWalletAddress: "0xf2afbb3f13Ca72bfb69749f3bC5EbD6528b1fc31",
        },
        notifications: {
          url: "wss://notification-stage.rasa.capital/ws/v1/subscribe",
          channel: "Arbitrum_Solver-Low-Cap_Stage",
          protocol: "enigma",
          searchUrl: "https://notification.rasa.capital/notification",
        },
        capabilities: { groupClose: true, listingService: true },
      },
    },
    defaultSolverId: "enigma",
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-analytics/latest/gn",
      events:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-events/latest/gn",
    },
    priceService: {
      type: "enigma",
      url: "https://lowcap-price.enigma.bz",
      wsUrl: "wss://lowcap-price.enigma.bz/ws",
    },
    muon: {
      urls: [
        "https://muon-oracle1.rasa.capital/v1/",
        "https://muon-oracle2.rasa.capital/v1/",
        "https://muon-oracle3.rasa.capital/v1/",
        "https://muon-oracle4.rasa.capital/v1/",
      ],
    },
    listing: {
      url: "https://listing85.enigma.bz",
    },
    inventory: {
      url: "https://inventory85.enigma.bz",
    },
  },
} satisfies CreateConfigParameters["symmioConfig"];

/** The staging preset, ready to render as a one-click action in the config panel. */
export const STAGING_PRESET: ConfigPreset = {
  id: "staging",
  label: "Staging",
  description:
    "Arbitrum staging contracts, the Enigma staging solver, and the staging notifications stream and subgraphs.",
  overrides: STAGING_CHAIN_OVERRIDES,
};
