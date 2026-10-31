import type { UseInstantOpenWithTpSlData, UseSetQuoteTpSlReturnType } from "@symmio/trading-react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useTpSlAttachmentRecovery } from "./use-tp-sl-attachment-recovery";

const mock = vi.hoisted(() => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isSuccess: false,
  error: null as UseSetQuoteTpSlReturnType["error"],
}));
vi.mock("@symmio/trading-react", () => ({ useSetQuoteTpSl: () => mock }));

const parameters: NonNullable<UseInstantOpenWithTpSlData["tpslParameters"]> = {
  chainId: 42161,
  quoteId: -123n,
  symbolId: 1n,
  positionType: 0,
  from: "0x0000000000000000000000000000000000000001",
  subAccount: "0x0000000000000000000000000000000000000002",
  virtualAccount: "0x0000000000000000000000000000000000000003",
  quantity: "5.123456789",
  pricePrecision: 6,
  tp: { triggerPrice: "12.345678", priceType: "markPrice" },
};
function error(code: string): NonNullable<UseInstantOpenWithTpSlData["tpslError"]> {
  return { name: "SymmioRequestError", kind: "api", code, message: "Handler response", retryAfterMs: null };
}
const data: UseInstantOpenWithTpSlData = {
  instantOpen: { kind: "enigma", success: true, tempQuoteId: "-123" },
  tpslParameters: parameters,
  tpslError: error("SET_TPSL_REJECTED"),
};
beforeEach(() => {
  mock.mutate.mockReset();
  mock.reset.mockReset();
  mock.isPending = false;
  mock.isSuccess = false;
  mock.error = null;
});
afterEach(cleanup);

test("recovery submits only the returned attachment, preserving quantity, negative ID, VA and chain", () => {
  const { result } = renderHook(() => useTpSlAttachmentRecovery({ data, isPending: false }));
  expect(mock.mutate).not.toHaveBeenCalled();
  act(() => {
    result.current.retryAttachment();
    result.current.retryAttachment();
  });
  expect(mock.mutate).toHaveBeenCalledTimes(1);
  expect(mock.mutate.mock.calls[0]?.[0]).toBe(parameters);
});
test("releases duplicate guard after settlement; a second explicit rejection permits manual retry", () => {
  const { result } = renderHook(() => useTpSlAttachmentRecovery({ data, isPending: false }));
  act(() => result.current.retryAttachment());
  act(() => mock.mutate.mock.calls[0]?.[1].onSettled());
  act(() => result.current.retryAttachment());
  expect(mock.mutate).toHaveBeenCalledTimes(2);
});
test.each(["NETWORK_ERROR", "SET_TPSL_INVALID_RESPONSE", "SET_TPSL_FAILED"])(
  "never submits an ambiguous %s outcome",
  (code) => {
    const { result } = renderHook(() =>
      useTpSlAttachmentRecovery({ data: { ...data, tpslError: error(code) }, isPending: false }),
    );
    act(() => result.current.retryAttachment());
    expect(mock.mutate).not.toHaveBeenCalled();
  },
);
test("an ambiguous retry disables recovery despite the earlier explicit rejection", () => {
  mock.error = error("NETWORK_ERROR");
  const { result } = renderHook(() => useTpSlAttachmentRecovery({ data, isPending: false }));
  act(() => result.current.retryAttachment());
  expect(mock.mutate).not.toHaveBeenCalled();
});
test("never retries a successful or pending attachment", () => {
  const { result, rerender } = renderHook(() => useTpSlAttachmentRecovery({ data, isPending: false }));
  mock.isPending = true;
  rerender();
  act(() => result.current.retryAttachment());
  mock.isPending = false;
  mock.isSuccess = true;
  rerender();
  act(() => result.current.retryAttachment());
  expect(mock.mutate).not.toHaveBeenCalled();
});
test("missing parameters and another open in flight prevent attachment recovery", () => {
  const { result, rerender } = renderHook((props) => useTpSlAttachmentRecovery(props), {
    initialProps: { data, isPending: true },
  });
  act(() => result.current.retryAttachment());
  rerender({ data: { ...data, tpslParameters: undefined }, isPending: false });
  act(() => result.current.retryAttachment());
  expect(mock.mutate).not.toHaveBeenCalled();
});

test("a new open cannot discard recovery while attachment submission is in flight", () => {
  const { result } = renderHook(() => useTpSlAttachmentRecovery({ data, isPending: false }));
  act(() => result.current.retryAttachment());
  expect(result.current.resetForOpen()).toBe(false);
  expect(mock.reset).not.toHaveBeenCalled();
  act(() => mock.mutate.mock.calls[0]?.[1].onSettled());
  expect(result.current.resetForOpen()).toBe(true);
  expect(mock.reset).toHaveBeenCalledTimes(1);
});
