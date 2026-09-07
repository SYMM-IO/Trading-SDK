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
    contractsVersion: "0.8.5",
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
        notifications: {
          url: "wss://notification.rasa.capital/ws/v1/subscribe",
          channel: "Hyper-EVM_Solver-Low-Cap_Production",
          protocol: "enigma",
          // Same host as the WebSocket stream; the REST search API is served under
          // the `/notification` prefix (OpenAPI `servers[0].url`).
          searchUrl: "https://notification.rasa.capital/notification",
        },
        // VA-per-market/side isolation supports folding a group into one close.
        // `listingService`: declares this solver does the lowcap Pools/listing —
        // declarative only; the listing functions resolve the backend at chain level.
        capabilities: { groupClose: true, listingService: true },
      },
    },
    defaultSolverId: "enigma",
    priceService: {
      type: "enigma",
      url: "https://lowcap-price.enigma.bz",
      wsUrl: "wss://lowcap-price.enigma.bz/ws",
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
    listing: {
      // Pools listing backend. Host root only — the generated client's paths
      // already carry `/v2`, so a versioned base would 404.
      // Staging: https://listing-staging.enigma.bz
      url: "https://listing85.enigma.bz",
    },
    inventory: {
      // Custody backend behind the Pools; source of system-wide TVL. Host root
      // only — the generated client's paths already carry `/api/v1`.
      // Staging: https://inventory-staging.enigma.bz
      url: "https://inventory85.enigma.bz",
    },
  },

  [SymmioSupportedChainId.BASE]: {
    chainId: SymmioSupportedChainId.BASE,
    contractsVersion: "0.8.5",
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
        // Rasa's own position-state stream — real Base data. No `searchUrl`: the
        // rasa protocol serves notification history from the solver's own
        // position-state endpoint (via `searchNotifications`), not a REST service.
        notifications: {
          url: "wss://stage-archon.rasa.capital/ws/position-state-ws3",
          protocol: "rasa",
        },
        // Majors support LIMIT orders (pending open at a user-set price).
        capabilities: { limitOrder: true },
      },
    },
    defaultSolverId: "rasa",
    // Base's own analytics and events subgraphs (Goldsky) — real, production endpoints.
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/base_analytics/latest/gn",
      events: "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/base_events/latest/gn",
    },
    // Rasa serves majors and has no mark-price feed of its own — no REST mark
    // price, no mark-price WebSocket, no index price. Binance USD-M Futures is
    // the price source, matching how the reference UI configures this solver.
    //
    // Both URLs are public constants but stay in config on purpose: they are the
    // escape hatch for Binance's regional restrictions, so an integrator whose
    // users are blocked repoints them at their own proxy with no SDK change.
    priceService: {
      type: "binance",
      /** USD-M Futures REST root. The client appends `/fapi/v1/…`. */
      url: "https://fapi.binance.com",
      /**
       * All-symbols mark-price broadcast, 1 push/sec.
       *
       * The `/market/ws/` prefix is deliberate and was verified against the live
       * endpoint: Binance's *documented* `/ws/<stream>` form (and
       * `/stream?streams=`) connect and then never push a frame, which would ship
       * a feed that reports `open` and silently never ticks.
       */
      wsUrl: "wss://fstream.binance.com/market/ws/!markPrice@arr@1s",
    },
    // Muon is deployment-agnostic: one `symmio` app on one shared gateway set
    // serves every SYMMIO deployment, and the per-deployment input is the
    // `symmio` request param (this chain's diamond, from `addresses` above).
    // So these are Base's real gateways, not a HyperEVM stand-in.
    muon: {
      urls: [
        "https://muon-oracle1.rasa.capital/v1/",
        "https://muon-oracle2.rasa.capital/v1/",
        "https://muon-oracle3.rasa.capital/v1/",
        "https://muon-oracle4.rasa.capital/v1/",
      ],
    },
  },

  [SymmioSupportedChainId.ARBITRUM]: {
    chainId: SymmioSupportedChainId.ARBITRUM,
    contractsVersion: "0.8.6",
    addresses: {
      symmioAddress: "0x573310dB6d160B26026B8706EBe9831c7dEF1D09",
      // Replaced in the perps-core migration (2026-09-04). The previous value
      // (`0xDBc6DAe3…`) is still deployed and answers reads, so a stale config
      // fails late and opaquely: every InstantLayer EIP-712 domain binds to the
      // wrong `verifyingContract` and the gateway rejects the signature.
      instantLayerAddress: "0x2C9e944cB71329fC659Da50A10a79a508Dd49ba5",
      accountLayerAddress: "0x5733107211B2801Acd39933a54d482FE303c4907",
      affiliatesAddress: "0xe99c18CF3C62B9229f9251fd2562077a33e7600a",
      collateralAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      collateralDecimals: 6,
    },
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-analytics/latest/gn",
      events:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-events/latest/gn",
    },
    solvers: {
      enigma: {
        name: "Enigma",
        address: "0x9be79D4977D86D440F9e1Ea0d468A58104B9b932",
        url: "https://arb-staging.enigma.bz/api",
        // Arbitrum runs its own conditional-order handler and COH wallet; these
        // were a verbatim copy of HyperEVM's production block, which signed
        // Arbitrum TP/SL orders against the wrong COH wallet. `url` is a host
        // root — the client appends `/api/v5/…`.
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
          /** Host root: `searchEnigmaNotifications` appends `/api/v1/search`. */
          searchUrl: "https://notification-stage.rasa.capital",
        },
        capabilities: { groupClose: true, listingService: true },
      },
    },
    defaultSolverId: "enigma",
    // The staging solver's markets only exist in the staging price service —
    // against the production host roughly half of them have no mark price at
    // all. `url` is a host root; the client appends `/api/v1/…`.
    //
    // `wsUrl` deliberately does not share that host: it mirrors the reference
    // deployment, which pairs the staging Enigma REST service with this Rasa
    // socket (its production profile uses one host for both). Both accept
    // connections, so this follows the configuration known to work rather than
    // the symmetric-looking one.
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
    // TODO(vendor): inherited from HyperEVM and unconfirmed for Arbitrum — the
    // reference deployment declares no Arbitrum listing/inventory backend, so
    // Pools here may be showing HyperEVM data.
    listing: {
      url: "https://listing85.enigma.bz",
    },
    inventory: {
      url: "https://inventory85.enigma.bz",
    },
    /**
     * The GaslessQ relayer for this deployment. `url` is the vendor origin, so
     * `protocolInstance` is required to build the instance-scoped base — the
     * instance is not derivable from the chain id (staging and production are
     * both 42161). Server and CLI consumers add their own `apiKey`; browser
     * consumers must instead repoint `url` at a proxy that holds the key, since
     * a gateway client key cannot live in a bundle.
     *
     * No `execution` block on purpose: availability is not activation. Shipping
     * `mode: "gasless"` here would silently route every consumer's relayable
     * writes through this **staging** deployment, over a `url` that needs an
     * `apiKey` a browser cannot hold. Integrators activate it deliberately — a
     * `createConfig` override for the whole chain, or `gasless: true` per call.
     */
    gasless: {
      url: "https://gaslessq-staging.symmio.foundation",
      protocolInstance: "arbitrum-42161-vibe-stage",
      gaslessLayerAddress: "0x386EF97D913acf02B3C9452da4Cd4aaEc82eFBca",
    },
  },
};
