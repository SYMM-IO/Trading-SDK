import type { QuoteTpSlRow, TpSlNotification } from "@symmio/trading-core";
import { beforeEach, describe, expect, it } from "vitest";
import { linkTpSlNotificationIds, matchTpSlNotification } from "./match-tpsl-notification";
import { __resetTpSlStore, useTpSlStore } from "./tpsl-store";

function frame(overrides: Partial<TpSlNotification>): TpSlNotification {
  return {
    primaryIdentifier: 0,
    secondaryIdentifier: 0,
    quoteId: 0,
    conditionalOrderType: "take_profit",
    state: "new",
    successful: true,
    ...overrides,
  } as TpSlNotification;
}

/** Seed a store record for `id` so the match can resolve through the index. */
function seed(id: bigint) {
  useTpSlStore.getState().setRows(id, [] as QuoteTpSlRow[]);
}

beforeEach(() => __resetTpSlStore());

describe("matchTpSlNotification", () => {
  it("matches on the primary identifier", () => {
    seed(7n);

    expect(matchTpSlNotification(frame({ primaryIdentifier: 7 }), [7n])).toBe(7n);
  });

  it("matches on the secondary identifier", () => {
    seed(7n);

    expect(matchTpSlNotification(frame({ secondaryIdentifier: 7 }), [7n])).toBe(7n);
  });

  it("falls back to the raw quote id before any record exists", () => {
    expect(matchTpSlNotification(frame({ quoteId: 7 }), [7n])).toBe(7n);
  });

  it("resolves a temp-id frame onto the linked on-chain id", () => {
    seed(-5n);
    linkTpSlNotificationIds(frame({ primaryIdentifier: -5, secondaryIdentifier: 42 }));

    expect(matchTpSlNotification(frame({ primaryIdentifier: -5 }), [42n])).toBe(42n);
  });

  it("returns undefined for an unrelated frame", () => {
    seed(7n);

    expect(matchTpSlNotification(frame({ primaryIdentifier: 99, quoteId: 99 }), [7n])).toBeUndefined();
  });

  it("ignores placeholder ids in the candidate list", () => {
    expect(matchTpSlNotification(frame({ quoteId: 0, primaryIdentifier: 0 }), [undefined, 0n])).toBeUndefined();
  });

  it("returns the first matching candidate in caller order", () => {
    seed(7n);
    seed(8n);

    expect(matchTpSlNotification(frame({ primaryIdentifier: 8 }), [7n, 8n])).toBe(8n);
  });
});

describe("linkTpSlNotificationIds", () => {
  it("aliases both identifiers onto one record", () => {
    seed(-5n);

    linkTpSlNotificationIds(frame({ primaryIdentifier: -5, secondaryIdentifier: 42 }));

    const store = useTpSlStore.getState();
    expect(store.get(42n)).toBe(store.get(-5n));
  });

  it("does nothing when the frame carries only one identifier", () => {
    linkTpSlNotificationIds(frame({ primaryIdentifier: 42, secondaryIdentifier: 0 }));

    expect(useTpSlStore.getState().get(42n)).toBeUndefined();
  });
});
