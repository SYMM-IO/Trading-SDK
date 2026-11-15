import { expect, expectTypeOf, it } from "vitest";
import type { EnigmaNotificationEnvelope, RawEnigmaPositionNotification } from "./types";
it("accepts a previously typed position payload in the existing envelope interface", () => {
  const data: RawEnigmaPositionNotification = { quote_id: 7 };
  const envelope: EnigmaNotificationEnvelope = { address: "0x1", data };
  expectTypeOf<RawEnigmaPositionNotification>().toExtend<EnigmaNotificationEnvelope["data"]>();
  expect(envelope.data).toBe(data);
});
