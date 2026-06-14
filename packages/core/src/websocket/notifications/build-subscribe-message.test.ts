import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { buildSubscribeMessage } from "./build-subscribe-message";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;

describe("buildSubscribeMessage", () => {
  it("builds a defilytics channel_patterns frame scoped to the account", () => {
    const frame = JSON.parse(buildSubscribeMessage({ account: ACCOUNT, channel: "Chan", protocol: "defilytics" }));
    expect(frame).toEqual({
      channel_patterns: [{ app_name: "Chan", address: ACCOUNT, primary_identifier: "*", secondary_identifier: "*" }],
    });
  });

  it("throws for an unsupported protocol", () => {
    expect(() => buildSubscribeMessage({ account: ACCOUNT, channel: "Chan", protocol: "rasa" as never })).toThrow(
      SymmError,
    );
  });
});
