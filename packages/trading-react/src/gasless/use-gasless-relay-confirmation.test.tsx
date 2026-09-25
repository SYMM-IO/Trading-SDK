import {
  createConfig,
  GaslessRequestStatus,
  getGaslessRequestQueryKey,
  SymmError,
  SymmioSupportedChainId,
  type ConfirmGaslessRequestParameters,
  type GaslessRequest,
} from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "../test/test-utils";

const relayInstantOperations = vi.hoisted(() => vi.fn());
const confirmGaslessRequest = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return {
    ...actual,
    relayInstantOperationsMutationOptions: () => ({
      mutationKey: ["relayInstantOperations"] as const,
      mutationFn: relayInstantOperations,
    }),
    confirmGaslessRequest,
  };
});

import { useRelayInstantOperations } from "./use-relay-instant-operations";

const CHAIN = SymmioSupportedChainId.ARBITRUM;
const OWNER = "0xBabAD9AAA1a617886c272CEC2Ce7A132Fe2ECf29";
const TX_HASH = `0x${"cd".repeat(32)}` as const;
const INSTANCE = "arbitrum-42161-test";

function buildConfig() {
  return createConfig({
    getClient: () => ({ waitForTransactionReceipt: vi.fn() }) as unknown as PublicClient,
    symmioConfig: { [CHAIN]: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
  });
}

const VARIABLES = {
  chainId: CHAIN,
  userAddress: OWNER,
  operationType: "allocate",
  operations: [{ operation: { signerAccount: { addr: OWNER, isPartyB: false } }, signature: "0x00" }],
} as unknown as Parameters<ReturnType<typeof useRelayInstantOperations>["mutateAsync"]>[0];

function requestRecord(overrides?: Partial<GaslessRequest>): GaslessRequest {
  return {
    service: "operations",
    requestId: "req-1",
    status: GaslessRequestStatus.QUEUED,
    txHash: null,
    errorCode: null,
    errorMessage: null,
    idempotencyKey: "key-1",
    owner: OWNER,
    walletIds: [0n],
    createdAt: null,
    updatedAt: null,
    operationType: "allocate",
    accountId: null,
    feeAmountRaw: null,
    ...overrides,
  } as GaslessRequest;
}

/** The `202` every test starts from: accepted, queued, nothing on chain yet. */
const ACCEPTANCE = {
  requestId: "req-1",
  status: GaslessRequestStatus.QUEUED,
  idempotencyKey: "key-1",
  protocolInstance: INSTANCE,
  owner: OWNER,
  walletIds: [1n],
};

describe("useGaslessRelayConfirmation", () => {
  beforeEach(() => {
    relayInstantOperations.mockReset();
    confirmGaslessRequest.mockReset();
    relayInstantOperations.mockResolvedValue(ACCEPTANCE);
    confirmGaslessRequest.mockResolvedValue({
      request: requestRecord({ status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH }),
      txHash: TX_HASH,
    });
  });

  it("publishes submitting for the window the confirmation cannot see", async () => {
    const config = buildConfig();
    let releaseSubmit: () => void = () => {};
    const accepted = new Promise<void>((resolve) => {
      releaseSubmit = resolve;
    });
    relayInstantOperations.mockImplementation(async () => {
      await accepted;
      return ACCEPTANCE;
    });
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config }));

    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = result.current.mutateAsync(VARIABLES);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    /** Signing and the POST: nothing is accepted yet, so there is no id to show. */
    expect(result.current.relay.phase).toBe("submitting");
    expect(result.current.relay.requestId).toBeUndefined();

    await act(async () => {
      releaseSubmit();
      await pending;
    });

    expect(result.current.relay.phase).toBe("confirmed");
  });

  it("reports a submit that never reached the service as an error, with no request to watch", async () => {
    const config = buildConfig();
    relayInstantOperations.mockRejectedValue(new SymmError("api", "GASLESS_RELAY_SUBMIT_FAILED", "gateway down"));
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config }));

    await act(async () => {
      await expect(result.current.mutateAsync(VARIABLES)).rejects.toBeTruthy();
    });

    expect(result.current.relay.phase).toBe("error");
    /** Nothing was accepted: re-running the intent through the wallet is safe here. */
    expect(result.current.relay.requestId).toBeUndefined();
    expect(confirmGaslessRequest).not.toHaveBeenCalled();
  });

  it("hands the acceptance to onAccepted before any confirmation runs", async () => {
    const config = buildConfig();
    const onAccepted = vi.fn(() => {
      /** Persistence happens first: nothing may have been confirmed by now. */
      expect(confirmGaslessRequest).not.toHaveBeenCalled();
    });
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config, onAccepted }));

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });

    expect(onAccepted).toHaveBeenCalledWith({
      requestId: "req-1",
      service: "operations",
      chainId: CHAIN,
      protocolInstance: INSTANCE,
      idempotencyKey: "key-1",
      operationType: "allocate",
      owner: OWNER,
      walletIds: [1n],
    });
  });

  it("still fires onAccepted for confirmation: 'none', where nothing else ever would", async () => {
    const config = buildConfig();
    const onAccepted = vi.fn();
    const { result } = renderHookWithProviders(() =>
      useRelayInstantOperations({ config, onAccepted, confirmation: "none" }),
    );

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });

    expect(onAccepted).toHaveBeenCalledTimes(1);
    expect(confirmGaslessRequest).not.toHaveBeenCalled();
    expect(result.current.relay.idempotencyKey).toBe("key-1");
  });

  it("survives a throwing onAccepted — the service already accepted the request", async () => {
    const config = buildConfig();
    const { result } = renderHookWithProviders(() =>
      useRelayInstantOperations({
        config,
        onAccepted: () => {
          throw new Error("storage blew up");
        },
      }),
    );

    await act(async () => {
      await expect(result.current.mutateAsync(VARIABLES)).resolves.toMatchObject({
        confirmed: { txHash: TX_HASH },
      });
    });
  });

  it("marks the relay degraded while the status is unreadable, and clears it on the next read", async () => {
    const config = buildConfig();
    let releaseWait: () => void = () => {};
    const blocked = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    confirmGaslessRequest.mockImplementation(async (_config: unknown, parameters: ConfirmGaslessRequestParameters) => {
      parameters.onTransportIssue?.(new SymmError("api", "GASLESS_STATUS_FETCH_FAILED", "429 Too Many Requests"));
      await blocked;
      parameters.onUpdate?.(requestRecord({ status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH }));
      return { request: requestRecord({ status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH }), txHash: TX_HASH };
    });
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config }));

    let pending: Promise<unknown> | undefined;
    await act(async () => {
      pending = result.current.mutateAsync(VARIABLES);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    /** Blind, not broken: the phase stays on the lifecycle and the failure is exposed as an issue. */
    expect(result.current.relay.degraded).toBe(true);
    expect(result.current.relay.phase).toBe("queued");
    expect(result.current.relay.issue?.code).toBe("GASLESS_STATUS_FETCH_FAILED");

    await act(async () => {
      releaseWait();
      await pending;
    });

    /** A relay that finished is never left looking unreachable. */
    expect(result.current.relay.degraded).toBe(false);
    expect(result.current.relay.issue).toBeUndefined();
    expect(result.current.relay.phase).toBe("confirmed");
  });

  it("reports a timed-out wait as unconfirmed, not as a failure", async () => {
    const config = buildConfig();
    confirmGaslessRequest.mockRejectedValue(
      new SymmError("api", "GASLESS_TERMINAL_TIMEOUT", "Gasless: request req-1 did not reach a terminal status"),
    );
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config }));

    await act(async () => {
      await expect(result.current.mutateAsync(VARIABLES)).rejects.toMatchObject({
        code: "GASLESS_TERMINAL_TIMEOUT",
      });
    });

    /** The mutation rejects — it has no result — but the phase must not say "failed". */
    expect(result.current.relay.phase).toBe("unconfirmed");
    expect(result.current.relay.requestId).toBe("req-1");
    expect(result.current.relay.idempotencyKey).toBe("key-1");
  });

  it("still reports a real verdict as an error", async () => {
    const config = buildConfig();
    confirmGaslessRequest.mockRejectedValue(new SymmError("api", "GASLESS_RELAY_REVERTED", "reverted"));
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config }));

    await act(async () => {
      await expect(result.current.mutateAsync(VARIABLES)).rejects.toBeTruthy();
    });

    expect(result.current.relay.phase).toBe("error");
  });

  it("seeds the record cache, and refuses to overwrite it with a stale response", async () => {
    const config = buildConfig();
    /** A real gcTime: a seeded record must outlive the mutation that wrote it. */
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    confirmGaslessRequest.mockImplementation(async (_config: unknown, parameters: ConfirmGaslessRequestParameters) => {
      parameters.onUpdate?.(requestRecord({ status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH }));
      /** A slow `queued` poll answering after the terminal one. */
      parameters.onUpdate?.(requestRecord({ status: GaslessRequestStatus.QUEUED }));
      return { request: requestRecord({ status: GaslessRequestStatus.SUCCEEDED, txHash: TX_HASH }), txHash: TX_HASH };
    });
    const { result } = renderHookWithProviders(() => useRelayInstantOperations({ config }), { queryClient });

    await act(async () => {
      await result.current.mutateAsync(VARIABLES);
    });

    const seeded = queryClient.getQueryData<GaslessRequest>(
      getGaslessRequestQueryKey({
        chainId: CHAIN,
        requestId: "req-1",
        service: "operations",
        configKey: config.getChainConfigKey(CHAIN),
      }),
    );
    expect(seeded?.status).toBe(GaslessRequestStatus.SUCCEEDED);
  });
});
