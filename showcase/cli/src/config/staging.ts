import { SymmioSupportedChainId, type CreateConfigParameters } from "@symmio/trading-core";
import { recordGaslessRelayEvent } from "../sdk/gasless-request-journal.js";

/**
 * Canonical Arbitrum staging bundle used by the SDK integration app. Keeping the
 * contracts and service endpoints together prevents an operation from being
 * signed for one InstantLayer and sent to another deployment's gateway.
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
    listing: { url: "https://listing85.enigma.bz" },
    inventory: { url: "https://inventory85.enigma.bz" },
    gasless: {
      url: "https://gaslessq-staging.symmio.foundation",
      protocolInstance: "arbitrum-42161-vibe-stage",
      gaslessLayerAddress: "0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca",
      statusStream: { enabled: true },
      execution: { mode: "gasless", fallback: "error", onEvent: recordGaslessRelayEvent },
    },
  },
} satisfies CreateConfigParameters["symmioConfig"];
