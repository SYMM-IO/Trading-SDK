import { SymmioSupportedChainId } from "./supported-chains";
import type { SymmioChainConfig } from "./types";

/**
 * Built-in SYMMIO deployment configs keyed by chain ID.
 *
 * @internal
 */
export const CHAIN_CONFIGS: Record<number, SymmioChainConfig> = {
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
    // So these are Base's real gateways, not another chain's stand-in.
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
      symmioAddress: "0x57331027091994FCb9c5Aec48ea92cEf0a93CF6A",
      instantLayerAddress: "0xCB8F789d6f7e59B3D266490e1Aa8e35cFb755132",
      accountLayerAddress: "0x573310d1D6ec18cB21E1aB949414470D9bf5c24E",
      affiliatesAddress: "0x58bB5Bdc279321507DfB7AB54B9e7EF3DdA6E24D",
      collateralAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      collateralDecimals: 6,
    },
    subgraphs: {
      analytics:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-mainnet-analytics/latest/gn",
      events:
        "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/arbitrum-vibe-mainnet-events/stage/gn",
    },
    solvers: {
      enigma: {
        name: "Enigma",
        address: "0x0420b24359d2DCccA53904042aa36A641162445c",
        url: "https://solver.enigma.bz/api",
        tpsl: {
          url: "https://tpsl.enigma.bz",
          wsUrl: "wss://notification.rasa.capital/ws/v1/subscribe",
          appName: "Arbitrum_COH_Production",
          cohWalletAddress: "0xFC3a98d30AdAA220Ae4150fcaC06Bd200b6E146B",
        },
        notifications: {
          url: "wss://notification.rasa.capital/ws/v1/subscribe",
          channel: "Arbitrum_Solver-Low-Cap_Production",
          protocol: "enigma",
          searchUrl: "https://notification.rasa.capital/notification",
        },
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
};
