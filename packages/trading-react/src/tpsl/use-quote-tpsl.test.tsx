import type { Config, GetQuoteTpSlOptions } from "@symmio/trading-core";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderHookWithProviders } from "../test/test-utils";

/** How many times the handler read actually ran. */
const fetches = vi.hoisted(() => ({ count: 0 }));

/**
 * The real query factory is kept — the key it builds is what this file is
 * about — and only the network call and the socket are stubbed out.
 */
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getQuoteTpSlQueryOptions: (config: Config, options: GetQuoteTpSlOptions) => ({
      ...actual.getQuoteTpSlQueryOptions(config, options),
      queryFn: async () => {
        fetches.count += 1;
        return [];
      },
    }),
    watchTpSlNotifications: () => () => {},
  };
});

import { invalidateTpSlReads } from "./invalidate-tpsl";
import { __resetTpSlStore } from "./tpsl-store";
import { useQuoteTpSl } from "./use-quote-tpsl";

const QUOTE_ID = 17_209n;
const SUB_ACCOUNT = "0x00000000000000000000000000000000000000a1" as const;
const VIRTUAL_ACCOUNT = "0x00000000000000000000000000000000000000b1" as const;

describe("useQuoteTpSl", () => {
  beforeEach(() => {
    fetches.count = 0;
    __resetTpSlStore();
  });

  it("shares one cache entry across callers that pass different accounts", async () => {
    const queryClient = createTestQueryClient();

    renderHookWithProviders(
      () => {
        // The three shapes that coexist on a page: a flow keyed on the
        // SubAccount, a row cell keyed on the Virtual Account, and a caller
        // that watches no socket at all.
        useQuoteTpSl({ quoteId: QUOTE_ID, account: SUB_ACCOUNT });
        useQuoteTpSl({ quoteId: QUOTE_ID, account: VIRTUAL_ACCOUNT });
        useQuoteTpSl({ quoteId: QUOTE_ID });
      },
      { queryClient },
    );

    await waitFor(() => expect(fetches.count).toBe(1));
    expect(queryClient.getQueryCache().findAll({ queryKey: ["getQuoteTpSl"] })).toHaveLength(1);
  });

  it("issues a single request per invalidation, not one per mounted account", async () => {
    const queryClient = createTestQueryClient();

    renderHookWithProviders(
      () => {
        useQuoteTpSl({ quoteId: QUOTE_ID, account: SUB_ACCOUNT });
        useQuoteTpSl({ quoteId: QUOTE_ID, account: VIRTUAL_ACCOUNT });
      },
      { queryClient },
    );

    await waitFor(() => expect(fetches.count).toBe(1));

    await act(async () => {
      await invalidateTpSlReads(queryClient, [QUOTE_ID]);
    });

    await waitFor(() => expect(fetches.count).toBe(2));
    expect(fetches.count).toBe(2);
  });
});
