import { SymmioSupportedChainId } from "./supported-chains";
import type { SymmioChainConfig } from "./types";

/**
 * Built-in SYMMIO deployment configs keyed by chain ID.
 *
 * @internal
 */
export const CHAIN_CONFIGS: Record<number, SymmioChainConfig> = {
  [SymmioSupportedChainId.HYPER_EVM]: {
    chainId: SymmioSupportedChainId.HYPER_EVM,
    addresses: {
      symmioAddress: "0x57331038c21982116EE9b0906E4a5c5cB52dcE2e",
      instantLayerAddress: "0x72DBF07457b2712b160F67A85D338F860c1CA620",
      accountLayerAddress: "0x46493c376758Da47823D7E3Ae5d417eA6546eEB3",
      affiliatesAddress: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
      collateralAddress: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
      collateralDecimals: 6,
    },
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_analytics/latest/gn",
      events:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_events/latest/gn",
    },
    solvers: {
      enigma: {
        name: "Enigma",
        address: "0x76bc5889c0cfcC20960b0D81F541595d81a95122",
        url: "https://solver.enigma.bz/api",
        tpsl: {
          url: "https://conditional-orders-handler-lowcap85.rasa.capital",
          wsUrl: "wss://notification.rasa.capital/ws/v1/subscribe",
          appName: "Hyper-EVM_COH-Low-Cap_Production",
          cohWalletAddress: "0xf2afbb3f13Ca72bfb69749f3bC5EbD6528b1fc31",
        },
      },
    },
    defaultSolverId: "enigma",
    priceService: {
      type: "enigma",
      url: "https://lowcap-price.enigma.bz",
      wsUrl: "wss://lowcap-price.enigma.bz/ws",
    },
    notifications: {
      url: "wss://notification.rasa.capital/ws/v1/subscribe",
      channel: "Hyper-EVM_Solver-Low-Cap_Production",
      protocol: "defilytics",
      // Same host as the WebSocket stream; the REST search API is served under
      // the `/notification` prefix (OpenAPI `servers[0].url`).
      searchUrl: "https://notification.rasa.capital/notification",
    },
    muon: {
      // Muon oracle gateways (https://docs.symm.io/api-endpoints-and-deployments/muon-api),
      // tried in order until one returns a successful attestation.
      urls: [
        "https://muon-oracle1.rasa.capital/v1/",
        "https://muon-oracle2.rasa.capital/v1/",
        "https://muon-oracle3.rasa.capital/v1/",
        "https://muon-oracle4.rasa.capital/v1/",
      ],
    },
  },

  [SymmioSupportedChainId.BASE]: {
    chainId: SymmioSupportedChainId.BASE,
    addresses: {
      symmioAddress: "0x91Cf2D8Ed503EC52768999aA6D8DBeA6e52dbe43",
      instantLayerAddress: "0x0825435285ac0E5c02c7a7c443F631f3e07fE375",
      accountLayerAddress: "0x56caf00c6C5cB5478570Bb23807B9d1D697863DC",
      affiliatesAddress: "0x45Eecd7B4f442388ACD90467E423A5CAAC3a9C3f",
      collateralAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      collateralDecimals: 6,
    },
    // Rasa — Base's real solver. Rasa's API shares Enigma's paths for the
    // shared reads (contract-symbols, funding, locked params, error codes,
    // notional_cap/{id}, instant lists), so those work today; the diverging
    // endpoints (`/instant_trade/open|close` execution, `/estimated-price`,
    // `/notional_cap` list) return 404 until per-kind dispatch is wired into
    // the solver actions.
    // No `tpsl` block: Base COH deployment not confirmed yet — absence marks
    // conditional orders unsupported (add the block when the vendor provides it).
    solvers: {
      rasa: {
        name: "Rasa",
        address: "0x81631953E0C093e72935C1CAA4C7D519B2A0E407",
        // Staging URL — swap to the production solver URL when published.
        url: "https://stage-archon.rasa.capital",
      },
    },
    defaultSolverId: "rasa",
    // ── PLACEHOLDER services (HyperEVM values) ──────────────────────────────
    // Base does not have its own subgraphs / price service / notifications / muon
    // yet. These point at HyperEVM's endpoints so the config is complete and the
    // SDK compiles/runs; they return HyperEVM data, NOT Base data. Replace each
    // block with Base's real endpoint as that service is integrated — one at a time.
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_analytics/latest/gn",
      events:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_events/latest/gn",
    },
    priceService: {
      type: "enigma",
      url: "https://lowcap-price.enigma.bz",
      wsUrl: "wss://lowcap-price.enigma.bz/ws",
    },
    notifications: {
      url: "wss://notification.rasa.capital/ws/v1/subscribe",
      channel: "Hyper-EVM_Solver-Low-Cap_Production",
      protocol: "defilytics",
      searchUrl: "https://notification.rasa.capital/notification",
    },
    muon: {
      urls: [
        "https://muon-oracle1.rasa.capital/v1/",
        "https://muon-oracle2.rasa.capital/v1/",
        "https://muon-oracle3.rasa.capital/v1/",
        "https://muon-oracle4.rasa.capital/v1/",
      ],
    },
  },
};
