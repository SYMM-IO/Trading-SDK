import {
  ActionStatus,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  NotificationType,
  OrderType,
  PositionType,
  QuoteStatus,
  type LockedValues,
  type Notification,
  type Quote,
} from "@symmio/trading-core";
import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { hyperEvm } from "viem/chains";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { createTestQueryClient, renderHookWithProviders, TEST_EOA } from "../test/test-utils";

/**
 * Mutable test state shared with the module mock: the rows the on-chain
 * open-positions read returns right now, and the live notification handler
 * `useNotifications` registered.
 */
const state = vi.hoisted(() => ({
  onchainRows: [] as unknown[],
  reads: 0,
  onNotification: undefined as ((notification: unknown) => void) | undefined,
}));

/**
 * Keep the real query keys (the hook's invalidations match on them) and swap only
 * the `queryFn`, so the test controls what the chain "returns" per read. The
 * notifications socket is replaced by a captured handler reporting `open`, which
 * is the case that matters: with the event channel live the hook does not idle
 * poll, so a read only happens when something explicitly refetches it.
 */
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    getPartyAOpenPositionsQueryOptions: (...args: Parameters<typeof actual.getPartyAOpenPositionsQueryOptions>) => ({
      ...actual.getPartyAOpenPositionsQueryOptions(...args),
      queryFn: async () => {
        state.reads += 1;
        return state.onchainRows;
      },
    }),
    watchNotifications: (
      _config: unknown,
      parameters: { onNotification: (n: unknown) => void; onStatusChange?: (s: string) => void },
    ) => {
      state.onNotification = parameters.onNotification;
      parameters.onStatusChange?.("open");
      return () => {
        state.onNotification = undefined;
      };
    },
  };
});

import { useManagedQuotes } from "./use-managed-quotes";

const PARTY_B: Address = "0x000000000000000000000000000000000000b22b";
const ZERO_LOCKED: LockedValues = { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n };

/** The on-chain position the anchored quote resolves to, once the read catches up. */
const ANCHORED_QUOTE: Quote = {
  id: 228468n,
  partyBsWhiteList: [],
  symbolId: 4n,
  positionType: PositionType.LONG,
  orderType: OrderType.MARKET,
  openedPrice: 1_371200000000000000n,
  initialOpenedPrice: 1_371200000000000000n,
  requestedOpenPrice: 1_385000000000000000n,
  marketPrice: 1_371182160000000000n,
  quantity: 7_000000000000000000n,
  closedAmount: 0n,
  initialLockedValues: ZERO_LOCKED,
  lockedValues: ZERO_LOCKED,
  maxFundingRate: 0n,
  partyA: TEST_EOA,
  partyB: PARTY_B,
  quoteStatus: QuoteStatus.OPENED,
  avgClosedPrice: 0n,
  requestedClosePrice: 0n,
  quantityToClose: 0n,
  parentId: 0n,
  createTimestamp: 1_787345777n,
  statusModifyTimestamp: 1_787345777n,
  lastFundingPaymentTimestamp: 0n,
  deadline: 0n,
  tradingFee: 0n,
  affiliate: "0x0000000000000000000000000000000000000000",
  accumulatedPaidFunding: 0n,
  closeFee: 0n,
  data: "0x",
};

/**
 * A live notification frame. Defaults to the open **anchor** a solver emits when it
 * broadcasts the transaction — a real on-chain `quoteId` alongside the negative
 * pre-chain `tempQuoteId`, exactly as the wire carries it.
 */
function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "065e07ce",
    quoteId: "228468",
    tempQuoteId: -815,
    type: NotificationType.SUCCESS,
    actionStatus: ActionStatus.SUCCESS,
    lastSeenAction: "SendQuoteTransaction",
    account: TEST_EOA,
    vaAddress: null,
    counterpartyAddress: TEST_EOA,
    filledAmountOpen: "7",
    filledAmountClose: null,
    avgPriceOpen: "1.3712",
    avgPriceClose: "",
    failureType: null,
    failureMessage: null,
    errorCode: null,
    stateType: "alert",
    createTime: "1787345777",
    modifyTime: "1787345777",
    raw: {},
    ...overrides,
  } as Notification;
}

/** Only the on-chain open-positions read is in play; every other source is off. */
function renderManaged(queryClient?: QueryClient) {
  return renderHookWithProviders(
    () =>
      useManagedQuotes({
        partyA: TEST_EOA,
        chainId: hyperEvm.id,
        includeVirtualAccounts: false,
        sources: { pendingQuotes: false, instantOpens: false, instantCloses: false },
      }),
    queryClient ? { queryClient } : undefined,
  );
}

/**
 * The chain-config fingerprint the hook scopes its invalidations by. Built from a
 * throwaway render of the same provider stack — `getChainConfigKey` is a pure
 * function of the config, so it matches the one the hook under test computes.
 */
function renderConfigKey(): string {
  const { result } = renderHookWithProviders(() => useSymmioConfig().getChainConfigKey(hyperEvm.id));
  return result.current;
}

/** Let the debounced notification invalidation fire and its read settle. */
async function settleDebouncedInvalidation() {
  await new Promise((resolve) => setTimeout(resolve, 400));
}

describe("useManagedQuotes — open-confirm hold", () => {
  beforeEach(() => {
    state.onchainRows = [];
    state.reads = 0;
    state.onNotification = undefined;
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps re-reading after an anchor notification until the position lands on-chain", async () => {
    const { result } = renderManaged();
    await waitFor(() => expect(state.reads).toBeGreaterThan(0));
    expect(result.current.quotes).toEqual([]);

    /* The solver reports the anchor when it *broadcasts* the tx, so every read
       triggered by the notification itself still misses the block. */
    act(() => state.onNotification?.(notification()));
    await settleDebouncedInvalidation();
    expect(result.current.quotes).toEqual([]);

    /* The block lands. Nothing else refetches — the event channel is live (no idle
       poll) and no row ever reached WRITE_ONCHAIN — so only the hold can find it. */
    state.onchainRows = [ANCHORED_QUOTE];

    await waitFor(() => expect(result.current.quotes).toHaveLength(1), { timeout: 5_000 });
    expect(result.current.quotes[0]?.quoteId).toBe(228468n);
  });

  it("does not chase a frame that has not anchored (no on-chain id yet)", async () => {
    const { result } = renderManaged();
    await waitFor(() => expect(state.reads).toBeGreaterThan(0));

    /* The pre-chain price fill: the rasa wire repeats the negative temp id as the
       quote id, so there is nothing on-chain to confirm and nothing to chase. */
    act(() => state.onNotification?.(notification({ quoteId: "-815", lastSeenAction: "InstantRFQ" })));
    await settleDebouncedInvalidation();

    state.onchainRows = [ANCHORED_QUOTE];
    const readsBefore = state.reads;
    await new Promise((resolve) => setTimeout(resolve, 1_500));

    expect(state.reads).toBe(readsBefore);
    expect(result.current.quotes).toEqual([]);
  });
});

/** The resting LIMIT order after `requestToCancelQuote` locked it into CANCEL_PENDING. */
const CANCEL_PENDING_QUOTE: Quote = {
  ...ANCHORED_QUOTE,
  id: 228466n,
  orderType: OrderType.LIMIT,
  openedPrice: 0n,
  initialOpenedPrice: 0n,
  requestedOpenPrice: 1_000000000000000000n,
  quantity: 10_000000000000000000n,
  quoteStatus: QuoteStatus.CANCEL_PENDING,
  createTimestamp: 1_787344717n,
  statusModifyTimestamp: 1_787344735n,
};

/** The cancel-request frame — the only cancel notification a solver is known to emit. */
function cancelNotification(overrides: Partial<Notification> = {}): Notification {
  return notification({
    id: "a3ddf277",
    quoteId: "228466",
    tempQuoteId: -814,
    lastSeenAction: "RequestToCancelQuote",
    filledAmountOpen: "0",
    avgPriceOpen: "0",
    createTime: "1787344738",
    modifyTime: "1787344738",
    ...overrides,
  });
}

describe("useManagedQuotes — cancel-confirm hold", () => {
  beforeEach(() => {
    state.onchainRows = [];
    state.reads = 0;
    state.onNotification = undefined;
  });
  afterEach(() => vi.restoreAllMocks());

  it("drops a cancelled order once the solver accepts, with no notification for the accept", async () => {
    state.onchainRows = [CANCEL_PENDING_QUOTE];
    const { result } = renderManaged();
    await waitFor(() => expect(result.current.quotes).toHaveLength(1));

    /* The frame reports only the *request*. The read it triggers still shows
       CANCEL_PENDING, because the solver has not answered yet. */
    act(() => state.onNotification?.(cancelNotification()));
    await settleDebouncedInvalidation();
    expect(result.current.quotes).toHaveLength(1);

    /* `acceptCancelRequest` mines and the contract drops the id from
       `partyAPendingQuotes`. No frame announces it, the event channel is live so
       there is no idle poll, and a CANCEL_PENDING row is lifecycle ONCHAIN so it
       accelerates nothing — only the hold can notice. */
    state.onchainRows = [];

    await waitFor(() => expect(result.current.quotes).toEqual([]), { timeout: 5_000 });
  });

  it("does not chase an unrelated action", async () => {
    state.onchainRows = [CANCEL_PENDING_QUOTE];
    const { result } = renderManaged();
    await waitFor(() => expect(result.current.quotes).toHaveLength(1));

    act(() => state.onNotification?.(cancelNotification({ lastSeenAction: "SomethingElse" })));
    await settleDebouncedInvalidation();

    state.onchainRows = [];
    const readsBefore = state.reads;
    await new Promise((resolve) => setTimeout(resolve, 1_500));

    expect(state.reads).toBe(readsBefore);
    expect(result.current.quotes).toHaveLength(1);
  });
  it("re-reads the balances while a cancel is in flight — the accept refunds the fee and no frame says so", async () => {
    state.onchainRows = [CANCEL_PENDING_QUOTE];
    const queryClient = createTestQueryClient();
    const { result } = renderManaged(queryClient);
    await waitFor(() => expect(result.current.quotes).toHaveLength(1));

    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    act(() => state.onNotification?.(cancelNotification()));

    /** Run every predicate handed to `invalidateQueries` since the frame against one key. */
    const matches = (key: QueryKey) =>
      invalidate.mock.calls.some(([filters]) => {
        const { predicate } = filters as { predicate?: (q: Query) => boolean };
        return predicate?.({ queryKey: key } as Query<unknown, Error, unknown, QueryKey>) ?? false;
      });

    const configKey = renderConfigKey();
    await waitFor(() => expect(matches(getAccountBalanceOfQueryKey({ configKey }))).toBe(true));
    expect(matches(getAccountBalanceInfoQueryKey({ configKey }))).toBe(true);
    /** Another chain config's balances must survive. */
    expect(matches(getAccountBalanceOfQueryKey({ configKey: "other" }))).toBe(false);
  });
});
