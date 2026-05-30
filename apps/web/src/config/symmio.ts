import { SymmioSupportedChainId } from "@symm-frontier/core";
import type { SymmioClientConfigInput } from "@symm-frontier/react";

const VIBE_AFFILIATE_BY_CHAIN = {
  [SymmioSupportedChainId.HYPER_EVM]: "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
} as const;

export const symmioConfig = {
  chainId: SymmioSupportedChainId.HYPER_EVM,
  affiliateAddress: VIBE_AFFILIATE_BY_CHAIN[SymmioSupportedChainId.HYPER_EVM],
} satisfies SymmioClientConfigInput;
