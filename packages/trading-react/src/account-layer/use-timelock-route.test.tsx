import { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { rememberTimelockCapability, timelockCapabilityKey } from "../solvers/timelock-capability-cache";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useTimelockRoute } from "./use-timelock-route";

const stubs = vi.hoisted(() => ({ virtual: vi.fn(), selector: vi.fn(), info: vi.fn(), policy: vi.fn() }));
vi.mock("./use-virtual-account", () => ({ useVirtualAccount: stubs.virtual }));
vi.mock("./use-timelock", () => ({ useSelectorTimelock: stubs.selector }));
vi.mock("../solvers/use-solver-info", () => ({ useSolverInfo: stubs.info }));
vi.mock("./use-timelock-policy", () => ({ useTimelockPolicy: stubs.policy }));

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const ROOT = "0x2222222222222222222222222222222222222222" as const;
const UNLOCKER = "0x3333333333333333333333333333333333333333" as const;
const SELECTOR = "0x12345678" as const;

function fixture(enabled = true) {
  const { config } = createMockSymmioConfig();
  const solver = config.getSolver();
  vi.spyOn(config, "getSolver").mockReturnValue({
    ...solver,
    capabilities: { ...solver.capabilities, timelockApproval: enabled },
  });
  const capability = {
    unlocker: UNLOCKER,
    minTimelockDelaySeconds: 300,
    validitySeconds: 60,
    requestDomain: {
      name: "SymmioTimelockApprovalRequest" as const,
      version: "1" as const,
      chainId: "42161",
      verifyingContract: config.getChainConfig().addresses.accountLayerAddress,
    },
  };
  stubs.virtual.mockReturnValue({ isSuccess: true, data: { isExists: true, parentAccount: ROOT } });
  stubs.selector.mockReturnValue({ data: { unlocker: UNLOCKER, delay: 300n } });
  stubs.info.mockReturnValue({ isSuccess: true, data: { timelockApproval: capability } });
  stubs.policy.mockReturnValue({ data: { ready: true } });
  return { config, capability };
}

beforeEach(() => vi.clearAllMocks());

describe("useTimelockRoute", () => {
  it("offers delayed recovery when known solver support is temporarily unavailable", () => {
    const { config, capability } = fixture();
    const queryClient = new QueryClient();
    rememberTimelockCapability(queryClient, timelockCapabilityKey(config, 42161), capability);
    stubs.info.mockReturnValue({ error: { kind: "api", status: 503, message: "unavailable" } });
    const { result } = renderHookWithProviders(
      () => useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
      {
        queryClient,
      },
    );
    expect(result.current.route).toEqual({ kind: "delayed", rootAccount: ROOT, unlocker: UNLOCKER, delay: 300n });
    expect(stubs.info.mock.lastCall?.[0].query.enabled).toBe(false);
  });
  it("does not start solver or policy reads when disabled", () => {
    const { config } = fixture();
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR, enabled: false }),
    );
    expect(result.current.route).toEqual({ kind: "normal" });
    expect(stubs.info.mock.lastCall?.[0].query.enabled).toBe(false);
    expect(stubs.selector.mock.lastCall?.[0].query.enabled).toBe(false);
    expect(stubs.virtual.mock.lastCall?.[0].query.enabled).toBe(false);
  });
  it("keeps solvers without the capability on the normal path", () => {
    const { config } = fixture(false);
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(result.current.route).toEqual({ kind: "normal" });
    expect(stubs.selector.mock.lastCall?.[0].query.enabled).toBe(false);
  });

  it("discovers advertised support when the configuration does not specify it", () => {
    const { config, capability } = fixture();
    const solver = config.getSolver();
    vi.mocked(config.getSolver).mockReturnValue({ ...solver, id: "enigma", capabilities: {} });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(stubs.info.mock.lastCall?.[0].query.enabled).toBe(true);
    expect(result.current.route).toEqual({ kind: "approval", rootAccount: ROOT, capability });
  });

  it("does not infer the normal route from an unavailable solver when support is unknown", () => {
    const { config } = fixture();
    const solver = config.getSolver();
    vi.mocked(config.getSolver).mockReturnValue({ ...solver, id: "enigma", capabilities: {} });
    stubs.info.mockReturnValue({ error: { kind: "api", status: 503, message: "unavailable" } });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(result.current.route).toEqual({ kind: "error", message: "unavailable" });
  });

  it("keeps the normal route when solver discovery confirms no timelock support", () => {
    const { config } = fixture();
    const solver = config.getSolver();
    vi.mocked(config.getSolver).mockReturnValue({ ...solver, id: "enigma", capabilities: {} });
    stubs.info.mockReturnValue({ isSuccess: true, data: {} });
    stubs.selector.mockReturnValue({ data: { unlocker: zeroAddress, delay: 0n } });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(result.current.route).toEqual({ kind: "normal" });
  });

  it("does not bypass an on-chain lock when solver metadata is absent", () => {
    const { config } = fixture();
    const solver = config.getSolver();
    vi.mocked(config.getSolver).mockReturnValue({ ...solver, id: "enigma", capabilities: {} });
    stubs.info.mockReturnValue({ isSuccess: true, data: {} });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(result.current.route).toMatchObject({ kind: "error" });
  });

  it("permits an unlocked selector even when solver discovery fails", () => {
    const { config } = fixture();
    const solver = config.getSolver();
    vi.mocked(config.getSolver).mockReturnValue({ ...solver, id: "enigma", capabilities: {} });
    stubs.info.mockReturnValue({ error: { kind: "api", status: 503, message: "unavailable" } });
    stubs.selector.mockReturnValue({ data: { unlocker: zeroAddress, delay: 0n } });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(result.current.route).toEqual({ kind: "normal" });
  });

  it("uses the known policy for delayed recovery when a discovered solver becomes unavailable", () => {
    const { config, capability } = fixture();
    const solver = config.getSolver();
    vi.mocked(config.getSolver).mockReturnValue({ ...solver, id: "enigma", capabilities: {} });
    stubs.info.mockReturnValue({
      data: { timelockApproval: capability },
      error: { kind: "api", status: 503, message: "unavailable" },
    });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(result.current.route).toEqual({ kind: "delayed", rootAccount: ROOT, unlocker: UNLOCKER, delay: 300n });
  });

  it("allows a non-Enigma provider to declare support through supplied metadata", () => {
    const { config, capability } = fixture();
    const solver = config.getSolver();
    vi.mocked(config.getSolver).mockReturnValue({ ...solver, capabilities: {} });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR, capability }),
    );
    expect(result.current.route).toEqual({ kind: "approval", rootAccount: ROOT, capability });
  });

  it("uses the root policy and directs a locked operation to approval", () => {
    const { config, capability } = fixture();
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(result.current.route).toEqual({ kind: "approval", rootAccount: ROOT, capability });
    expect(stubs.selector.mock.lastCall?.[0].account).toBe(ROOT);
  });

  it("runs only the protected callback and passes the selected provider metadata", async () => {
    const { config, capability } = fixture();
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    const normal = vi.fn();
    const protectedWrite = vi.fn().mockResolvedValue({ receipt: { status: "success" } });
    await act(async () => {
      await expect(result.current.run({ normal, protected: protectedWrite, deadline: 123n })).resolves.toMatchObject({
        kind: "submitted",
      });
    });
    expect(normal).not.toHaveBeenCalled();
    expect(protectedWrite).toHaveBeenCalledOnce();
    expect(protectedWrite.mock.calls[0]![0]).toMatchObject({ capability, deadline: 123n });
    expect(result.current.attempt).toBeUndefined();
  });

  it("uses the normal route for an unlocked selector", () => {
    const { config } = fixture();
    stubs.selector.mockReturnValue({ data: { unlocker: zeroAddress, delay: 0n } });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    expect(result.current.route).toEqual({ kind: "normal" });
  });

  it("offers delayed recovery on an unavailable info service without an approval request", async () => {
    const { config, capability } = fixture();
    stubs.info.mockReturnValue({
      data: { timelockApproval: capability },
      error: { kind: "api", status: 503, message: "unavailable" },
    });
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    const normal = vi.fn();
    const protectedWrite = vi.fn();
    expect(await result.current.run({ normal, protected: protectedWrite })).toMatchObject({
      kind: "delayed",
      rootAccount: ROOT,
      delay: 300n,
    });
    expect(normal).not.toHaveBeenCalled();
    expect(protectedWrite).not.toHaveBeenCalled();
  });

  it("stops after approval if the hook unmounts, retaining the caller's recovery callback", async () => {
    const { config } = fixture();
    const { result, unmount } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const onApproval = vi.fn();
    const protectedWrite = vi.fn(async (authorization) => {
      await waiting;
      await authorization.onApproval({ signedApproval: {} });
      return { receipt: { status: "success" } };
    });
    const operation = result.current.run({
      normal: vi.fn(),
      protected: protectedWrite,
      deadline: 1n,
      onApproval,
    });
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    release();
    await expect(operation).rejects.toThrow("changed");
    expect(onApproval).toHaveBeenCalledOnce();
  });

  it("does not call the provider if the hook unmounts while an approval request is being prepared", async () => {
    const { config } = fixture();
    const requestApproval = vi.fn();
    const { result, unmount } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR, provider: { requestApproval } }),
    );
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const protectedWrite = vi.fn(async (authorization) => {
      await waiting;
      await authorization.provider.requestApproval({});
      return { receipt: { status: "success" } };
    });
    const operation = result.current.run({ normal: vi.fn(), protected: protectedWrite, deadline: 1n });
    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    release();
    await expect(operation).rejects.toThrow("changed before requesting approval");
    expect(requestApproval).not.toHaveBeenCalled();
  });

  it("never starts fallback or repeats a protected attempt after an ambiguous failure", async () => {
    const { config } = fixture();
    const { result, rerender } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    const normal = vi.fn();
    const protectedWrite = vi.fn().mockRejectedValue(new Error("response lost"));
    await act(async () => {
      await expect(result.current.run({ normal, protected: protectedWrite, deadline: 1n })).rejects.toThrow(
        "response lost",
      );
    });
    stubs.info.mockReturnValue({ error: { kind: "api", status: 503, message: "unavailable" } });
    rerender();
    await expect(result.current.run({ normal, protected: protectedWrite, deadline: 1n })).rejects.toThrow(
      "requires reconciliation",
    );
    expect(protectedWrite).toHaveBeenCalledOnce();
    expect(normal).not.toHaveBeenCalled();
  });

  it("blocks another selector of the same root while an attempt needs reconciliation", async () => {
    const { config } = fixture();
    let selected: `0x${string}` = SELECTOR;
    const { result, rerender } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: selected }),
    );
    await act(async () => {
      await expect(
        result.current.run({
          normal: vi.fn(),
          protected: vi.fn().mockRejectedValue(new Error("timeout")),
          deadline: 1n,
        }),
      ).rejects.toThrow("timeout");
    });
    selected = "0x87654321";
    rerender();
    expect(result.current.route.kind).toBe("reconciliation");
  });

  it("allows a fresh main-path attempt after a definite pending-position rejection", async () => {
    const { config } = fixture();
    const { result } = renderHookWithProviders(() =>
      useTimelockRoute({ config, account: ACCOUNT, selector: SELECTOR }),
    );
    const rejection = new SymmioRequestError({
      kind: "api",
      code: "3703",
      message: "Pending open",
      timelock: { code: 3703, knownCode: 3703, errorCategory: "account_state", errorMessage: "Pending open" },
    });
    const protectedWrite = vi
      .fn()
      .mockRejectedValueOnce(rejection)
      .mockResolvedValueOnce({ receipt: { status: "success" } });
    await act(async () => {
      await expect(result.current.run({ normal: vi.fn(), protected: protectedWrite, deadline: 1n })).rejects.toBe(
        rejection,
      );
    });
    await act(async () => {
      await expect(
        result.current.run({ normal: vi.fn(), protected: protectedWrite, deadline: 1n }),
      ).resolves.toMatchObject({ kind: "submitted" });
    });
    expect(protectedWrite).toHaveBeenCalledTimes(2);
  });
});
