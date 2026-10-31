import type { UseInstantOpenWithTpSlData } from "@symmio/trading-react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { canRetryAttachment, TpSlAttachmentStatus } from "./tp-sl-attachment-status";

type Props = ComponentProps<typeof TpSlAttachmentStatus>;
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
const open: UseInstantOpenWithTpSlData = {
  instantOpen: { kind: "enigma", success: true, tempQuoteId: "-123" },
  tpslParameters: parameters,
};
function error(code: string): NonNullable<UseInstantOpenWithTpSlData["tpslError"]> {
  return { name: "SymmioRequestError", kind: "api", code, message: "Handler response", retryAfterMs: null };
}
function render(data: Props["data"], retry: Partial<Props["retry"]> = {}, attaching = false) {
  return renderToStaticMarkup(
    <TpSlAttachmentStatus
      idPrefix="test"
      data={data}
      attaching={attaching}
      retry={{ isPending: false, isSuccess: false, error: null, ...retry }}
      onRetry={() => {
        throw new Error("Rendering must never retry a write");
      }}
    />,
  );
}

test("acceptance directs users to current orders without claiming activation is pending or complete", () => {
  const html = render({ ...open, tpsl: { success: true } });
  expect(html).toContain("TP/SL request accepted. Check current TP/SL orders to verify activation.");
  expect(html).not.toContain("activation is still pending");
  expect(html).not.toContain("WebSocket will confirm");
  expect(html).not.toContain("Retry TP/SL only");
});
test("explicit rejection offers attachment-only recovery with exact identifiers and size", () => {
  const html = render({ ...open, tpslError: error("SET_TPSL_REJECTED") });
  expect(html).toContain("Position open request accepted");
  expect(html).toContain("attachment request rejected");
  expect(html).toContain("Retry TP/SL only");
  expect(html).toContain("-123");
  expect(html).toContain("5.123456789");
});
for (const code of ["SET_TPSL_INVALID_RESPONSE", "NETWORK_ERROR", "SET_TPSL_FAILED", "INSTANT_OPEN_TPSL_INVALID_ID"]) {
  test(`no blind retry for ${code}`, () => {
    expect(canRetryAttachment(error(code))).toBe(false);
    const html = render({ ...open, tpslError: error(code) });
    expect(html).toContain("protection is unconfirmed");
    expect(html).toContain("Check current TP/SL orders");
    expect(html).not.toContain("Retry TP/SL only");
  });
}
test("missing recovery parameters never offers a retry", () => {
  const html = render({ ...open, tpslParameters: undefined, tpslError: error("SET_TPSL_REJECTED") });
  expect(html).toContain("identifiers are unavailable");
  expect(html).not.toContain("Retry TP/SL only");
});
test("pending attachment hides retry controls", () => {
  for (const html of [render(open, {}, true), render(open, { isPending: true })]) {
    expect(html).toContain("Submitting TP/SL attachment");
    expect(html).not.toContain("Retry TP/SL only");
  }
});
test("successful recovery supersedes the original rejection", () => {
  const html = render({ ...open, tpslError: error("SET_TPSL_REJECTED") }, { isSuccess: true });
  expect(html).toContain("request accepted");
  expect(html).toContain("Check current TP/SL orders to verify activation.");
  expect(html).not.toContain("activation is still pending");
  expect(html).not.toContain("request rejected");
  expect(html).not.toContain("Retry TP/SL only");
});
test("an ambiguous retry replaces the earlier rejection and prevents another retry", () => {
  const html = render({ ...open, tpslError: error("SET_TPSL_REJECTED") }, { error: error("NETWORK_ERROR") });
  expect(html).toContain("protection is unconfirmed");
  expect(html).not.toContain("Retry TP/SL only");
});
