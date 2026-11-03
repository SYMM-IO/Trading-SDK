import { TimelockApprovalHttpError, TimelockBatchExecutionError, TimelockExecutionError } from "@symmio/trading-core";
import { QueryClient } from "@tanstack/react-query";
import { UserRejectedRequestError } from "viem";
import { describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { automaticAttemptKey, reserveAutomaticAttempt } from "./automatic-timelock-attempt";
import { useAutomaticTimelock } from "./use-automatic-timelock";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;
const UNLOCKER = "0x2222222222222222222222222222222222222222" as const;

describe("useAutomaticTimelock", () => {
  it("reuses discovered solver capability across operations but reads the account policy each time", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
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
    const policy = { rootAccount: ACCOUNT, ready: true, selectors: [{ status: "ok" }] };
    const fetch = vi
      .spyOn(queryClient, "fetchQuery")
      .mockResolvedValueOnce({ timelockApproval: capability } as never)
      .mockResolvedValueOnce(policy as never)
      .mockResolvedValueOnce(policy as never)
      .mockResolvedValueOnce({ rootAccount: ACCOUNT, ready: false, selectors: [{ status: "missing" }] } as never);
    const original = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...original(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient });
    const input = { account: ACCOUNT, chainId: 42161, functionName: "addMargin" };
    expect(await result.current({}, input)).toMatchObject({ capability });
    expect(await result.current({}, input)).toMatchObject({ capability });
    expect(await result.current({}, input)).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[0]![0].queryKey[0]).toBe("getSolverInfo");
    expect(fetch.mock.calls[1]![0].queryKey[0]).toBe("getTimelockPolicy");
    expect(fetch.mock.calls[2]![0].queryKey[0]).toBe("getTimelockPolicy");
    expect(fetch.mock.calls[3]![0].queryKey[0]).toBe("getTimelockPolicy");
  });
  it("does not read solver or policy when the deployment is explicitly unsupported", async () => {
    const { config } = createMockSymmioConfig();
    const queryClient = new QueryClient();
    const fetch = vi.spyOn(queryClient, "fetchQuery");
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient });
    await expect(
      result.current({}, { account: ACCOUNT, chainId: 42161, functionName: "addMargin" }),
    ).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reuses the same one-shot authorization for a retried mutation", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    const capability = {
      unlocker: UNLOCKER,
      minTimelockDelaySeconds: 300,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig(42161).addresses.accountLayerAddress,
      },
    };
    const fetch = vi
      .spyOn(queryClient, "fetchQuery")
      .mockResolvedValueOnce({ timelockApproval: capability } as never)
      .mockResolvedValueOnce({ rootAccount: ACCOUNT, ready: true, selectors: [{ status: "ok" }] } as never);
    const original = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...original(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient });
    const variables = {};
    const input = { account: ACCOUNT, chainId: 42161, functionName: "addMargin" };
    const first = await result.current(variables, input);
    const retry = await result.current(variables, input);
    expect(first).toBe(retry);
    expect(first).toMatchObject({ capability, deadline: 1300n });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("preserves a caller-supplied approval without discovery", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    const fetch = vi.spyOn(queryClient, "fetchQuery");
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient });
    const explicit = {
      approval: {
        approval: {
          account: ACCOUNT,
          unlocker: UNLOCKER,
          callDataHash: `0x${"11".repeat(32)}` as const,
          deadline: 5000n,
          salt: `0x${"22".repeat(32)}` as const,
        },
        signature: "0x11" as const,
      },
    };
    await expect(
      result.current({}, { account: ACCOUNT, chainId: 42161, functionName: "addMargin", explicit }),
    ).resolves.toBe(explicit);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never assumes an unknown solver is safe when discovery fails", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "fetchQuery").mockRejectedValueOnce(new Error("unavailable"));
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient });
    await expect(result.current({}, { account: ACCOUNT, chainId: 42161, functionName: "addMargin" })).rejects.toThrow(
      "unavailable",
    );
  });

  it("permits an on-chain unlocked selector when solver discovery is unavailable", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "fetchQuery")
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce({ isExists: false } as never)
      .mockResolvedValueOnce({ unlocker: "0x0000000000000000000000000000000000000000" } as never);
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient });
    await expect(
      result.current({}, { account: ACCOUNT, chainId: 42161, functionName: "addMargin" }),
    ).resolves.toBeUndefined();
  });

  it("does not treat missing solver metadata as permission to bypass a locked selector", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "fetchQuery")
      .mockResolvedValueOnce({ timelockApproval: undefined } as never)
      .mockResolvedValueOnce({ isExists: false } as never)
      .mockResolvedValueOnce({ unlocker: UNLOCKER } as never);
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient });
    await expect(result.current({}, { account: ACCOUNT, chainId: 42161, functionName: "addMargin" })).rejects.toThrow(
      /solver did not provide timelock metadata/,
    );
  });

  it("requires a custom provider only when a non-Enigma solver has a locked selector", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const originalSolver = config.getSolver();
    vi.spyOn(config, "getSolver").mockReturnValue({
      ...originalSolver,
      id: "rasa",
      capabilities: { ...originalSolver.capabilities, timelockApproval: true },
    } as never);
    const client = new QueryClient();
    const fetch = vi
      .spyOn(client, "fetchQuery")
      .mockResolvedValueOnce({ isExists: false } as never)
      .mockResolvedValueOnce({ unlocker: "0x0000000000000000000000000000000000000000" } as never)
      .mockResolvedValueOnce({ isExists: false } as never)
      .mockResolvedValueOnce({ unlocker: UNLOCKER } as never);
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient: client });
    const input = { account: ACCOUNT, chainId: 42161, functionName: "addMargin" };
    await expect(result.current({}, input)).resolves.toBeUndefined();
    await expect(result.current({}, input)).rejects.toThrow(/Supply an explicit timelock authorization/);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("keeps an operation stable when equivalent inline options are rerendered", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    const capability = {
      unlocker: UNLOCKER,
      minTimelockDelaySeconds: 300,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig(42161).addresses.accountLayerAddress,
      },
    } as const;
    const provider = { requestApproval: vi.fn().mockRejectedValue(new Error("timeout")) };
    vi.spyOn(queryClient, "fetchQuery").mockResolvedValue({
      rootAccount: ACCOUNT,
      ready: true,
      selectors: [{ status: "ok" }],
    } as never);
    const original = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...original(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    const { result, rerender } = renderHookWithProviders(
      () =>
        useAutomaticTimelock(config, {
          provider,
          capability: { ...capability, requestDomain: { ...capability.requestDomain } },
        }),
      { queryClient },
    );
    const variables = {};
    const input = { account: ACCOUNT, chainId: 42161, functionName: "addMargin" };
    const first = await result.current(variables, input);
    rerender();
    await expect(result.current(variables, input)).resolves.toBe(first);
  });

  it("records an issued approval but stops execution when the bound account changes", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    const capability = {
      unlocker: UNLOCKER,
      minTimelockDelaySeconds: 300,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig(42161).addresses.accountLayerAddress,
      },
    } as const;
    const onApproval = vi.fn();
    const provider = { requestApproval: vi.fn().mockRejectedValue(new Error("unused")) };
    const options = { capability, provider, onApproval };
    vi.spyOn(queryClient, "fetchQuery").mockResolvedValue({
      rootAccount: ACCOUNT,
      ready: true,
      selectors: [{ status: "ok" }],
    } as never);
    const original = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...original(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    const { result, rerender } = renderHookWithProviders(
      ({ account }: { account: typeof ACCOUNT | typeof UNLOCKER }) => useAutomaticTimelock(config, options, account),
      { queryClient, initialProps: { account: ACCOUNT as typeof ACCOUNT | typeof UNLOCKER } },
    );
    const authorization = await result.current({}, { account: ACCOUNT, chainId: 42161, functionName: "addMargin" });
    if (!authorization || "approval" in authorization || !authorization.onApproval)
      throw new Error("Expected provider authorization");
    rerender({ account: UNLOCKER });
    await expect(authorization.onApproval({} as never)).rejects.toThrow(/configuration changed/);
    expect(onApproval).toHaveBeenCalledOnce();
  });

  it("records an issued approval but stops execution after unmount", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    const capability = {
      unlocker: UNLOCKER,
      minTimelockDelaySeconds: 300,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig(42161).addresses.accountLayerAddress,
      },
    } as const;
    const onApproval = vi.fn();
    const provider = { requestApproval: vi.fn().mockRejectedValue(new Error("unused")) };
    vi.spyOn(queryClient, "fetchQuery").mockResolvedValue({
      rootAccount: ACCOUNT,
      ready: true,
      selectors: [{ status: "ok" }],
    } as never);
    const original = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...original(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    const { result, unmount } = renderHookWithProviders(
      () => useAutomaticTimelock(config, { capability, provider, onApproval }),
      { queryClient },
    );
    const authorization = await result.current({}, { account: ACCOUNT, chainId: 42161, functionName: "addMargin" });
    if (!authorization || "approval" in authorization || !authorization.onApproval)
      throw new Error("Expected provider authorization");
    unmount();
    await expect(authorization.onApproval({} as never)).rejects.toThrow(/unmounted/);
    expect(onApproval).toHaveBeenCalledOnce();
  });

  it("does not reuse an authorization when the operation configuration changes", async () => {
    const { config } = createMockSymmioConfig();
    const queryClient = new QueryClient();
    const { result, rerender } = renderHookWithProviders(
      ({ enabled }: { enabled: boolean }) => useAutomaticTimelock(config, enabled),
      { queryClient, initialProps: { enabled: true } },
    );
    const variables = {};
    const input = { account: ACCOUNT, chainId: 42161, functionName: "addMargin" };
    await expect(result.current(variables, input)).resolves.toBeUndefined();
    rerender({ enabled: false });
    expect(() => result.current(variables, input)).toThrow(/configuration changed/);
  });

  it("rejects reuse of the same operation after the account changes", async () => {
    const { config } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config));
    const variables = {};
    await expect(
      result.current(variables, { account: ACCOUNT, chainId: 42161, functionName: "addMargin" }),
    ).resolves.toBeUndefined();
    expect(() => result.current(variables, { account: UNLOCKER, chainId: 42161, functionName: "addMargin" })).toThrow(
      /configuration changed/,
    );
  });

  it("blocks a second hook after an ambiguous approval until reconciliation", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const queryClient = new QueryClient();
    const capability = {
      unlocker: UNLOCKER,
      minTimelockDelaySeconds: 300,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig(42161).addresses.accountLayerAddress,
      },
    } as const;
    const provider = { requestApproval: vi.fn().mockRejectedValue(new Error("timeout")) };
    const fetch = vi
      .spyOn(queryClient, "fetchQuery")
      .mockResolvedValueOnce({ rootAccount: ACCOUNT, ready: true, selectors: [{ status: "ok" }] } as never)
      .mockResolvedValueOnce({ rootAccount: ACCOUNT, ready: true, selectors: [{ status: "ok" }] } as never);
    const original = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...original(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    const options = { capability, provider };
    const first = renderHookWithProviders(() => useAutomaticTimelock(config, options), { queryClient });
    const second = renderHookWithProviders(() => useAutomaticTimelock(config, options), { queryClient });
    const variables = {};
    const input = { account: ACCOUNT, chainId: 42161, functionName: "addMargin" };
    const authorization = await first.result.current(variables, input);
    const concurrent = await second.result.current({}, input);
    if (!authorization || "approval" in authorization || !concurrent || "approval" in concurrent)
      throw new Error("Expected provider authorizations");
    await expect(authorization.provider.requestApproval({} as never, undefined)).rejects.toThrow("timeout");
    first.result.current.fail(variables, new Error("timeout"));
    await expect(concurrent.provider.requestApproval({} as never, undefined)).rejects.toThrow(
      /requires reconciliation/,
    );
    expect(provider.requestApproval).toHaveBeenCalledTimes(1);
    first.unmount();
    fetch.mockResolvedValueOnce({ isExists: false } as never);
    const remounted = renderHookWithProviders(() => useAutomaticTimelock(config, options), { queryClient });
    await expect(remounted.result.current({}, input)).rejects.toThrow(/requires reconciliation/);
    expect(provider.requestApproval).toHaveBeenCalledTimes(1);
  });

  it("releases a definite rejection but preserves a partial batch approval", async () => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const client = new QueryClient();
    const capability = {
      unlocker: UNLOCKER,
      minTimelockDelaySeconds: 300,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig(42161).addresses.accountLayerAddress,
      },
    } as const;
    const rejection = new TimelockApprovalHttpError(
      400,
      { code: 3703 },
      { url: "https://solver.invalid", statusText: "", retryAfterMs: null },
    );
    const provider = {
      requestApproval: vi
        .fn()
        .mockRejectedValueOnce(rejection)
        .mockResolvedValueOnce({} as never)
        .mockRejectedValueOnce(rejection),
    };
    vi.spyOn(client, "fetchQuery").mockResolvedValue({
      rootAccount: ACCOUNT,
      ready: true,
      selectors: [{ status: "ok" }],
    } as never);
    const original = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...original(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config, { capability, provider }), {
      queryClient: client,
    });
    const key = automaticAttemptKey(42161, config.getChainConfig(42161).addresses.accountLayerAddress, ACCOUNT);
    const firstVariables = {};
    const input = { account: ACCOUNT, chainId: 42161, functionName: "addMargin" };
    const first = await result.current(firstVariables, input);
    if (!first || "approval" in first) throw new Error("Expected provider authorization");
    await expect(first.provider.requestApproval({} as never, undefined)).rejects.toBe(rejection);
    result.current.fail(firstVariables, rejection);
    expect(client.getQueryData(key)).toBeUndefined();

    const batchVariables = {};
    const batch = await result.current.batch(batchVariables, {
      account: ACCOUNT,
      chainId: 42161,
      functionNames: ["deallocate", "initiateWithdraw"],
    });
    const one = batch?.calls[0];
    const two = batch?.calls[1];
    if (!one || "approval" in one || !two || "approval" in two) throw new Error("Expected provider authorizations");
    await one.provider.requestApproval({} as never, undefined);
    await expect(two.provider.requestApproval({} as never, undefined)).rejects.toBe(rejection);
    result.current.fail(batchVariables, rejection);
    expect(client.getQueryData(key)).toMatchObject({ status: "reconciliation" });
  });

  it.each([
    { label: "a single call", batch: false, hash: undefined, uncertain: false, releases: true },
    { label: "a batch", batch: true, hash: undefined, uncertain: false, releases: true },
    {
      label: "a submitted transaction",
      batch: false,
      hash: `0x${"12".repeat(32)}` as const,
      uncertain: false,
      releases: false,
    },
    { label: "an uncertain relay submission", batch: false, hash: undefined, uncertain: true, releases: false },
  ])("handles wallet rejection after approval for $label", async ({ batch, hash, uncertain, releases }) => {
    const { config } = createMockSymmioConfig({ timelockApproval: true });
    const client = new QueryClient();
    const capability = {
      unlocker: UNLOCKER,
      minTimelockDelaySeconds: 300,
      validitySeconds: 60,
      requestDomain: {
        name: "SymmioTimelockApprovalRequest",
        version: "1",
        chainId: "42161",
        verifyingContract: config.getChainConfig(42161).addresses.accountLayerAddress,
      },
    } as const;
    const provider = { requestApproval: vi.fn().mockResolvedValue({} as never) };
    vi.spyOn(client, "fetchQuery").mockResolvedValue({
      rootAccount: ACCOUNT,
      ready: true,
      selectors: [{ status: "ok" }],
    } as never);
    const original = config.getClient.bind(config);
    vi.spyOn(config, "getClient").mockImplementation(
      (parameters) => ({ ...original(parameters), getBlock: async () => ({ timestamp: 1000n }) }) as never,
    );
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config, { capability, provider }), {
      queryClient: client,
    });
    const variables = {};
    const authorization = await result.current(variables, {
      account: ACCOUNT,
      chainId: 42161,
      functionName: "addMargin",
    });
    if (!authorization || "approval" in authorization) throw new Error("Expected provider authorization");
    await authorization.provider.requestApproval({} as never, undefined);
    const rejection = new UserRejectedRequestError(new Error("Rejected"));
    const cause = uncertain
      ? Object.assign(new Error("Relay outcome unknown", { cause: rejection }), { code: "GASLESS_SUBMIT_UNCONFIRMED" })
      : rejection;
    const failure = batch
      ? new TimelockBatchExecutionError([{} as never], ["0x12345678"], cause, hash)
      : new TimelockExecutionError({} as never, "0x12345678", cause, hash);
    result.current.fail(variables, failure);
    const key = automaticAttemptKey(42161, config.getChainConfig(42161).addresses.accountLayerAddress, ACCOUNT);
    if (releases) {
      expect(client.getQueryData(key)).toBeUndefined();
      await expect(result.current.guard({}, { account: ACCOUNT, chainId: 42161 })).resolves.toBeUndefined();
    } else {
      expect(client.getQueryData(key)).toMatchObject({ status: "reconciliation" });
    }
    expect(provider.requestApproval).toHaveBeenCalledTimes(1);
  });

  it("shares a root guard with virtual accounts without blocking other roots", async () => {
    const { config } = createMockSymmioConfig();
    const client = new QueryClient();
    const key = automaticAttemptKey(42161, config.getChainConfig(42161).addresses.accountLayerAddress, ACCOUNT);
    reserveAutomaticAttempt(client, key, {});
    const fetch = vi
      .spyOn(client, "fetchQuery")
      .mockResolvedValueOnce({ isExists: true, parentAccount: ACCOUNT } as never)
      .mockResolvedValueOnce({ isExists: false } as never);
    const { result } = renderHookWithProviders(() => useAutomaticTimelock(config), { queryClient: client });
    await expect(result.current({}, { account: UNLOCKER, chainId: 42161, functionName: "addMargin" })).rejects.toThrow(
      /requires reconciliation/,
    );
    await expect(
      result.current({}, { account: UNLOCKER, chainId: 42161, functionName: "addMargin" }),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
