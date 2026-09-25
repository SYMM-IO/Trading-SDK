import { encodeAbiParameters, type Address, type Hex } from "viem";

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

/** Encode the affiliate hook metadata for a low-cap sub-account. */
export function encodeSubAccountHookMetadata(partyBToBind: Address): Hex {
  return encodeAbiParameters(SUB_ACCOUNT_HOOK_METADATA_ABI, [{ rflCode: "", referrerTokenId: 0n, partyBToBind }]);
}
