import { decodeAbiParameters, zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { encodeSubAccountHookMetadata } from "./hook-metadata";

const SOLVER: Address = "0x0420b24359d2DCccA53904042aa36A641162445c";

/** Decode with the same tuple the affiliate hook decodes. */
function decode(metadata: `0x${string}`) {
  const [decoded] = decodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { type: "string", name: "rflCode" },
          { type: "uint256", name: "referrerTokenId" },
          { type: "address", name: "partyBToBind" },
        ],
      },
    ],
    metadata,
  );
  return decoded;
}

describe("encodeSubAccountHookMetadata", () => {
  it("encodes (rflCode, referrerTokenId, partyBToBind) as the hook decodes it", () => {
    const metadata = encodeSubAccountHookMetadata({ rflCode: "alice", referrerTokenId: 7n, partyBToBind: SOLVER });

    expect(decode(metadata)).toEqual({ rflCode: "alice", referrerTokenId: 7n, partyBToBind: SOLVER });
  });

  it("defaults to an empty, reusable code and no referrer", () => {
    expect(decode(encodeSubAccountHookMetadata({ partyBToBind: SOLVER }))).toEqual({
      rflCode: "",
      referrerTokenId: 0n,
      partyBToBind: SOLVER,
    });
  });

  it("keeps a referral code when there is no PartyB to bind", () => {
    expect(decode(encodeSubAccountHookMetadata({ rflCode: "alice" }))).toEqual({
      rflCode: "alice",
      referrerTokenId: 0n,
      partyBToBind: zeroAddress,
    });
    expect(decode(encodeSubAccountHookMetadata({ rflCode: "alice", partyBToBind: zeroAddress }))).toEqual({
      rflCode: "alice",
      referrerTokenId: 0n,
      partyBToBind: zeroAddress,
    });
  });

  it("keeps a referrer on its own", () => {
    expect(decode(encodeSubAccountHookMetadata({ referrerTokenId: 7n }))).toEqual({
      rflCode: "",
      referrerTokenId: 7n,
      partyBToBind: zeroAddress,
    });
  });

  it("returns 0x only when every field is empty", () => {
    expect(encodeSubAccountHookMetadata({})).toBe("0x");
    expect(encodeSubAccountHookMetadata({ rflCode: "", referrerTokenId: 0n, partyBToBind: zeroAddress })).toBe("0x");
  });
});
