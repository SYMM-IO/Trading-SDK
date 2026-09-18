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
 * subgraphs, Express Withdraw, the staging notifications WebSocket, and the staging GaslessQ relayer.
 */
export const STAGING_CHAIN_OVERRIDES = {
  [SymmioSupportedChainId.ARBITRUM]: {
    contractsVersion: "0.8.6",
    addresses: {
      symmioAddress: "0x573310dB6d160B26026B8706EBe9831c7dEF1D09",
      instantLayerAddress: "0x38AaBc7A73523Cd47c710FcdEb3b20ae02310180",
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
          url: "https://tpsl-stage.enigma.bz",
          wsUrl: "wss://notification-stage.rasa.capital/ws/v1/subscribe",
          appName: "ARB_COH_Low-Cap_Stage",
          cohWalletAddress: "0x5Cf3fC3722e1780220Ca94C04a6dc7Dfd7615661",
        },
        notifications: {
          url: "wss://notification-stage.rasa.capital/ws/v1/subscribe",
          channel: "Arbitrum_Solver-Low-Cap_Stage",
          protocol: "enigma",
          searchUrl: "https://notification-stage.rasa.capital",
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
      url: "https://lowcap-price-staging.enigma.bz",
      wsUrl: "wss://lowcap-price.rasa.capital/ws",
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
    expressWithdraw: {
      url: "/api/express-withdraw",
      providerAddress: "0x573310D7b04fF21BB8628C69eE103dDF4922294A",
    },
    /**
     * The staging GaslessQ relayer, paired with the staging InstantLayer above.
     * The built-in registry ships no gasless block, so every field is stated.
     *
     * `url` — a browser cannot reach the vendor origin: it needs the gateway
     * client key, and a key in the bundle is a leaked key. `/api/gasless/staging`
     * is this app's proxy, which injects the key server-side. The path names its
     * deployment so the proxy can refuse a request meant for the other one.
     *
     * `execution.mode` — without it the dispatcher's `enabled` stays `false`
     * and every relayable write silently falls through to `writeContract`,
     * which is a dead end on a wallet holding no native token. `fallback` stays
     * at its default (`"error"`) so a refused relay surfaces its precise error
     * instead of an out-of-gas one. Only `mode` and `fallback` belong here — the
     * block is JSON-persisted through the config overrides store, so a function
     * (`onEvent`) would not survive a reload.
     */
    gasless: {
      url: "/api/gasless/staging",
      protocolInstance: "arbitrum-42161-vibe",
      gaslessLayerAddress: "0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca",
      execution: { mode: "gasless" },
    },
  },
} satisfies CreateConfigParameters["symmioConfig"];

/** The staging preset, ready to render as a one-click action in the config panel. */
export const STAGING_PRESET: ConfigPreset = {
  id: "staging",
  label: "Staging",
  description: "Arbitrum staging contracts, Enigma services, Express Withdraw, notifications, and subgraphs.",
  overrides: STAGING_CHAIN_OVERRIDES,
};
