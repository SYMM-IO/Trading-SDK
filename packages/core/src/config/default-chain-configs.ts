import type { SymmioResolvedChainConfig } from "./symmio-config";
import { SymmioSupportedChainId } from "./symmio-config";

/**
 * Built-in SYMMIO deployment metadata keyed by environment and chain id.
 */
export const DEFAULT_SYMMIO_CHAIN_CONFIGS = {
  production: {
    [SymmioSupportedChainId.HYPER_EVM]: {
      environment: "production",
      chainId: SymmioSupportedChainId.HYPER_EVM,
      addresses: {
        symmioAddress: "0x57331038c21982116EE9b0906E4a5c5cB52dcE2e",
        instantLayerAddress: "0x72DBF07457b2712b160F67A85D338F860c1CA620",
        accountLayerAddress: "0x46493c376758Da47823D7E3Ae5d417eA6546eEB3",
        affiliatesAddress: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
        backedWithdrawBridgeAddress: "0xb1b12E91E456D02184E4B934Bd8dD0c443962015",
        collateralAddress: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
        collateralDecimals: 6,
      },
      subgraphs: {
        analytics:
          "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_analytics/latest/gn",
        events:
          "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_mainnet_events/latest/gn",
        vibe: "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/vibe-back-hyperevm-mainnet/latest/gn",
      },
      solver: {
        name: "Enigma",
        address: "0x76bc5889c0cfcC20960b0D81F541595d81a95122",
      },
    },
  },
  stage: {
    [SymmioSupportedChainId.HYPER_EVM]: {
      environment: "stage",
      chainId: SymmioSupportedChainId.HYPER_EVM,
      addresses: {
        symmioAddress: "0x99641E06d38F327166b3a48f86Ca2cbB3B4fB7EB",
        instantLayerAddress: "0xCeE28784EFE6EEaf6da977D3F1d0cf05E62717eB",
        accountLayerAddress: "0x812e98F31A4EfFC09dD82e6e87ff7456151a0dFB",
        affiliatesAddress: "0x98490Efdd691ab58601302F98E1492DC28eCAA56",
        collateralAddress: "0x6aA554A167864027A02051D3F5C553244439B7Fd",
        collateralDecimals: 18,
      },
      subgraphs: {
        analytics:
          "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_analytics/latest/gn",
        events: "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/hyperevm_events/latest/gn",
        vibe: "https://api.goldsky.com/api/public/project_cm1hfr4527p0f01u85mz499u8/subgraphs/vibe-back-hyperevm/latest/gn",
      },
      solver: {
        name: "Superflow",
        address: "0xf62a670cda28FfAE65eE2a42D6cf6CF05EC5E775",
      },
    },
  },
} as const satisfies Record<string, Record<number, SymmioResolvedChainConfig>>;
