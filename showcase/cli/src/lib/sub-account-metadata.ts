import { encodeAbiParameters, zeroAddress, type Address, type Hex } from "viem";

const SUB_ACCOUNT_HOOK_METADATA_ABI = [
  {
    type: "tuple",
    components: [
      { type: "string", name: "rflCode" },
      { type: "uint256", name: "referrerTokenId" },
      { type: "address", name: "partyBToBind" },
    ],
  },
] as const;

/** Encode the affiliate hook metadata expected by the configured deployments. */
export function encodeSubAccountHookMetadata(partyBToBind?: Address): Hex {
  if (partyBToBind === undefined || partyBToBind === zeroAddress) return "0x";
  return encodeAbiParameters(SUB_ACCOUNT_HOOK_METADATA_ABI, [{ rflCode: "", referrerTokenId: 0n, partyBToBind }]);
}
