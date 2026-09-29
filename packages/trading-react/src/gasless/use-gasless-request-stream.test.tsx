import { createConfig, GaslessRequestStatus, type GaslessRequest } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import type { PublicClient } from "viem";
import { arbitrum } from "viem/chains";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";
import { useGaslessRequest } from "./use-gasless-request";

const watchGaslessRequest = vi.hoisted(() => vi.fn());
const supportsGaslessStatusStream = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, watchGaslessRequest, supportsGaslessStatusStream };
});

const GASLESS_LAYER = "0x000000000000000000000000000000000000ea51" as const;
const REQUEST_ID = "3f1d2c4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

function buildConfig() {
  return createConfig({
    getClient: () => ({}) as unknown as PublicClient,
    symmioConfig: {
      [arbitrum.id]: {
        addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
        gasless: {
          url: "https://gaslessq-staging.symmio.foundation",
          protocolInstance: "arbitrum-42161-test",
          gaslessLayerAddress: GASLESS_LAYER,
          statusStream: { enabled: true },
        },
      },
    },
  });
}

function record(status: GaslessRequestStatus): GaslessRequest {
  return {
    service: "operations",
    requestId: REQUEST_ID,
    status,
    txHash: null,
    errorCode: null,
    errorMessage: null,
    idempotencyKey: null,
    owner: null,
    walletIds: [],
    createdAt: null,
    updatedAt: null,
    operationType: "initiateWithdraw",
    accountId: null,
    feeAmountRaw: null,
  } as unknown as GaslessRequest;
}

/** Capture the stream handlers so a test can deliver frames itself. */
function captureStream() {
  const unwatch = vi.fn();
  const handle: {
    unwatch: typeof unwatch;
    emit: (request: GaslessRequest) => void;
    setLive: (live: boolean) => void;
  } = {
    unwatch,
    emit: () => {
      throw new Error("the stream has not been subscribed yet");
    },
    setLive: () => {
      throw new Error("the stream has not been subscribed yet");
    },
  };
  watchGaslessRequest.mockImplementation((_config: unknown, parameters: Record<string, never>) => {
    const params = parameters as unknown as {
      onUpdate: (update: { kind: "snapshot"; request: GaslessRequest; transactions: [] }) => void;
      onStatusChange?: (status: string, detail: null) => void;
    };
    handle.emit = (request) => params.onUpdate({ kind: "snapshot", request, transactions: [] });
    handle.setLive = (live) => params.onStatusChange?.(live ? "live" : "degraded", null);
    return unwatch;
  });
  return handle;
}

describe("useGaslessRequest with the status stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders records the stream delivered and reports the stream live", async () => {
    supportsGaslessStatusStream.mockReturnValue(true);
    const stream = captureStream();

    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useGaslessRequest({ config, requestId: REQUEST_ID }));

    await waitFor(() => expect(watchGaslessRequest).toHaveBeenCalled());
    stream.setLive(true);
    stream.emit(record(GaslessRequestStatus.SUBMITTED));

    await waitFor(() => expect(result.current.data?.status).toBe(GaslessRequestStatus.SUBMITTED));
    expect(result.current.stream.live).toBe(true);
  });

  it("stays on polling, and never subscribes, when the deployment has no stream", async () => {
    supportsGaslessStatusStream.mockReturnValue(false);
    captureStream();

    const config = buildConfig();
    const { result } = renderHookWithProviders(() => useGaslessRequest({ config, requestId: REQUEST_ID }));

    /** Give the effect a tick; nothing should subscribe, and the hook stays on its poll. */
    await waitFor(() => expect(result.current.stream.status).toBe("idle"));
    expect(watchGaslessRequest).not.toHaveBeenCalled();
    expect(result.current.stream.live).toBe(false);
  });

  it("does not subscribe when the caller forces polling", async () => {
    supportsGaslessStatusStream.mockReturnValue(true);
    captureStream();

    const config = buildConfig();
    const { result } = renderHookWithProviders(() =>
      useGaslessRequest({ config, requestId: REQUEST_ID, transport: "poll" }),
    );

    await waitFor(() => expect(result.current.stream.status).toBe("idle"));
    expect(watchGaslessRequest).not.toHaveBeenCalled();
  });

  it("releases the subscription on unmount", async () => {
    supportsGaslessStatusStream.mockReturnValue(true);
    const stream = captureStream();

    const config = buildConfig();
    const { unmount } = renderHookWithProviders(() => useGaslessRequest({ config, requestId: REQUEST_ID }));
    await waitFor(() => expect(watchGaslessRequest).toHaveBeenCalled());
    unmount();

    expect(stream.unwatch).toHaveBeenCalled();
  });
});
