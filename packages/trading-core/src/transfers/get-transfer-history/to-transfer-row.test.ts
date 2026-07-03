import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { toTransferRow, type RawInternalTransferRow } from "./to-transfer-row";

const SUB = "0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A";
const OTHER = "0x4AF4cd703760C4F018cEF5059a43b2624cdEB038";

describe("toTransferRow", () => {
  const raw: RawInternalTransferRow = {
    id: "0xtx-1",
    sender: SUB.toLowerCase(),
    user: OTHER.toLowerCase(),
    amount: "600431998398848000",
    blockTimestamp: "1781100000",
    transactionHash: "0xdead",
  };

  it("parses fields, checksums endpoints, and tags outgoing when sender is a queried account", () => {
    const accountSet = new Set([SUB.toLowerCase()]);
    expect(toTransferRow(raw, accountSet)).toEqual({
      id: "0xtx-1",
      from: getAddress(SUB),
      to: getAddress(OTHER),
      amount: 600431998398848000n,
      timestamp: 1781100000,
      transaction: "0xdead",
      direction: "outgoing",
    });
  });

  it("tags incoming when the queried account is the recipient, not the sender", () => {
    const accountSet = new Set([OTHER.toLowerCase()]);
    expect(toTransferRow(raw, accountSet).direction).toBe("incoming");
  });
});
