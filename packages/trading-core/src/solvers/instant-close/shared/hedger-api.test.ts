import { afterEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmApiError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import type { ApiV2InstantCloseRequest } from "../../types/generated/enigma-solver";
import { sendInstantClose } from "./hedger-api";

const { postInstantTradeInstantClose, instantRequestToCloseWithSignatureInstantTradeClosePost } = vi.hoisted(() => ({
  postInstantTradeInstantClose: vi.fn(),
  instantRequestToCloseWithSignatureInstantTradeClosePost: vi.fn(),
}));

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../types/generated/enigma-solver")>()),
  postInstantTradeInstantClose,
}));

vi.mock("../../types/generated/rasa-solver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../types/generated/rasa-solver")>()),
  instantRequestToCloseWithSignatureInstantTradeClosePost,
}));

/** One opaque signed operation — dispatch/shape is what these tests probe, not calldata. */
const OPERATIONS = [{ signedOperation: {}, signature: "0x00" }] as unknown as ApiV2InstantCloseRequest["operations"];

describe("sendInstantClose — kind dispatch", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes a HyperEVM (Enigma) chain to /instant_trade/instant_close with a wrapped body", async () => {
    const { config } = mockConfig();
    postInstantTradeInstantClose.mockResolvedValue({ data: undefined });

    const result = await sendInstantClose(config, { operations: OPERATIONS });

    expect(result).toEqual({ success: true });
    expect(instantRequestToCloseWithSignatureInstantTradeClosePost).not.toHaveBeenCalled();
    const [body, options] = postInstantTradeInstantClose.mock.calls[0]!;
    expect(body).toEqual({ operations: OPERATIONS });
    expect(options.baseURL).toBe(config.getSolver({ chainId: SymmioSupportedChainId.HYPER_EVM }).url);
  });

  it("routes a Base (Rasa) chain to /instant_trade/close with the bare operations array", async () => {
    const { config } = mockConfig();
    instantRequestToCloseWithSignatureInstantTradeClosePost.mockResolvedValue({
      data: { successful: true },
      status: 200,
      statusText: "OK",
    });

    const result = await sendInstantClose(config, { chainId: SymmioSupportedChainId.BASE, operations: OPERATIONS });

    expect(result).toEqual({ success: true });
    expect(postInstantTradeInstantClose).not.toHaveBeenCalled();
    const [body, options] = instantRequestToCloseWithSignatureInstantTradeClosePost.mock.calls[0]!;
    // Rasa posts the array itself, not a `{ operations }` wrapper.
    expect(body).toBe(OPERATIONS);
    expect(options.baseURL).toBe(config.getSolver({ chainId: SymmioSupportedChainId.BASE }).url);
  });

  it("surfaces a Rasa `successful: false` status as a SymmApiError carrying the message", async () => {
    const { config } = mockConfig();
    instantRequestToCloseWithSignatureInstantTradeClosePost.mockResolvedValue({
      data: { successful: false, message: "quote already closed" },
      status: 200,
      statusText: "OK",
    });

    await expect(
      sendInstantClose(config, { chainId: SymmioSupportedChainId.BASE, operations: OPERATIONS }),
    ).rejects.toMatchObject({
      code: "SEND_INSTANT_CLOSE_REJECTED",
      message: expect.stringContaining("quote already closed"),
    });
  });

  it("wraps a transport failure as a SymmApiError", async () => {
    const { config } = mockConfig();
    const axiosError = Object.assign(new Error("boom"), { isAxiosError: true, config: {}, response: undefined });
    instantRequestToCloseWithSignatureInstantTradeClosePost.mockRejectedValue(axiosError);

    await expect(
      sendInstantClose(config, { chainId: SymmioSupportedChainId.BASE, operations: OPERATIONS }),
    ).rejects.toBeInstanceOf(SymmApiError);
  });
});
