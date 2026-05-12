import { type SymmioClientConfigInput, SymmioSupportedChainId } from "@symm-frontier/core";

import { IS_TEST_ENVIRONMENT } from "./environment";

const VIBE_AFFILIATE_BY_CHAIN = {
  [SymmioSupportedChainId.HYPER_EVM]: IS_TEST_ENVIRONMENT
    ? "0x98490Efdd691ab58601302F98E1492DC28eCAA56"
    : "0xBcB033C9154401fA000a1Ae60843f79f45741b7c",
} as const;

export const symmioConfig = {
  environment: IS_TEST_ENVIRONMENT ? "stage" : "production",
  chainId: SymmioSupportedChainId.HYPER_EVM,
  affiliateAddress: VIBE_AFFILIATE_BY_CHAIN[SymmioSupportedChainId.HYPER_EVM],
} satisfies SymmioClientConfigInput;
