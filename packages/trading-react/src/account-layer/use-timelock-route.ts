"use client";

import {
  createHttpTimelockApprovalProvider,
  type ConfigParameter,
  type SolverId,
  type TimelockApprovalCapability,
  type TimelockApprovalProvider,
  type TimelockAuthorization,
  type ValidatedTimelockApproval,
} from "@symmio/trading-core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { isAddressEqual, zeroAddress, type Address, type Hex } from "viem";
import { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { refreshTimelockInfoAfterUnavailable, useKnownTimelockCapability } from "../solvers/timelock-capability-cache";
import { useSolverInfo } from "../solvers/use-solver-info";
import { useSelectorTimelock } from "./use-timelock";
import { useTimelockPolicy } from "./use-timelock-policy";
import { useVirtualAccount } from "./use-virtual-account";

/** Inputs for resolving a single operation's timelock route. */
export type UseTimelockRouteParameters = ConfigParameter & {
  account?: Address;
  selector?: Hex;
  chainId?: number;
  solverId?: SolverId;
  /** Wallet identity, included in the attempt scope when supplied. */
  owner?: Address;
  /** Disable discovery and policy reads when the consuming flow does not use timelocks. Defaults to true. */
  enabled?: boolean;
  /** Non-Enigma providers can supply independently obtained deployment metadata. */
  capability?: TimelockApprovalCapability;
  /** Override the standard approval transport. Keep this reference stable while an attempt is running. */
  provider?: TimelockApprovalProvider;
};

/** Routing outcome. `delayed` requires the consumer to offer the on-chain schedule flow. */
export type TimelockRoute =
  | { kind: "loading" }
  | { kind: "reconciliation" }
  | { kind: "normal" }
  | { kind: "approval"; rootAccount: Address; capability: TimelockApprovalCapability }
  | { kind: "delayed"; rootAccount: Address; unlocker: Address; delay: bigint }
  | { kind: "error"; message: string };

/**
 * Select a route from the configured solver capability and the root selector policy.
 * `run` delegates execution to the supplied callbacks; it does not automatically
 * schedule an operation. Persist recovery in the consumer across unmounts and tabs.
 * A delayed result is only an option: reconcile prior ambiguous attempts first.
 * @param parameters - Account, selector, deployment and optional provider metadata.
 * @returns Current route and underlying reads for refresh and diagnostics.
 * @example const route = useTimelockRoute({ account, selector });
 */
export function useTimelockRoute(parameters: UseTimelockRouteParameters) {
  const config = useSymmioConfig(parameters);
  const queryClient = useQueryClient();
  const connectedChain = useSymmioChainId();
  const chainId = parameters.chainId ?? connectedChain;
  const solver = config.getSolver({ chainId, solverId: parameters.solverId });
  const currentScope = useRef("");
  const providerIdentity = useRef(parameters.provider);
  const providerRevision = useRef(0);
  if (providerIdentity.current !== parameters.provider) {
    providerIdentity.current = parameters.provider;
    providerRevision.current += 1;
  }
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const attempts = useRef(new Map<string, "pending" | "reconcile">());
  const [, refresh] = useState(0);
  const configured = solver.capabilities?.timelockApproval;
  const chainSupported = parameters.enabled !== false && config.getChainConfig(chainId).timelockSupported !== false;
  const known = useKnownTimelockCapability(config, chainId, parameters.solverId);
  const canDiscover =
    chainSupported && configured !== false && solver.id === "enigma" && !parameters.capability && !known;
  const info = useSolverInfo({
    chainId,
    solverId: parameters.solverId,
    config,
    query: { enabled: canDiscover, retry: false, staleTime: 0 },
  });
  const capability =
    parameters.capability ?? known ?? (info.isPlaceholderData ? undefined : info.data?.timelockApproval);
  const supported =
    chainSupported && configured !== false && (configured === true || Boolean(capability) || canDiscover);
  const virtual = useVirtualAccount({
    account: parameters.account,
    chainId,
    config,
    query: { enabled: supported && Boolean(parameters.account), retry: false },
  });
  const rootAccount = virtual.isSuccess
    ? virtual.data?.isExists
      ? virtual.data.parentAccount
      : parameters.account
    : undefined;
  const selector = useSelectorTimelock({
    account: rootAccount ?? zeroAddress,
    selector: parameters.selector ?? "0x00000000",
    chainId,
    config,
    query: { enabled: supported && Boolean(rootAccount && parameters.selector), retry: false },
  });
  const policy = useTimelockPolicy({
    account: parameters.account ?? zeroAddress,
    chainId,
    solverId: parameters.solverId,
    capability,
    selectors: parameters.selector ? [parameters.selector] : [],
    config,
    query: {
      enabled: supported && Boolean(parameters.account && parameters.selector && capability),
      retry: false,
      staleTime: 0,
    },
  });
  const attemptKey = `${chainId}:${config.getChainConfig(chainId).addresses.accountLayerAddress.toLowerCase()}:${(rootAccount ?? parameters.account)?.toLowerCase()}`;
  const scope = JSON.stringify([
    attemptKey,
    solver.id,
    solver.url,
    parameters.owner?.toLowerCase(),
    parameters.account?.toLowerCase(),
    parameters.selector?.toLowerCase(),
    parameters.enabled,
    configured,
    chainSupported,
    providerRevision.current,
    capability,
    selector.data?.unlocker,
    selector.data?.delay?.toString(),
  ]);
  currentScope.current = scope;
  let route: TimelockRoute;
  if (!chainSupported || configured === false) route = { kind: "normal" };
  else if (!supported) route = { kind: "normal" };
  else if (!parameters.account || !parameters.selector) route = { kind: "loading" };
  else if (virtual.error || selector.error)
    route = { kind: "error", message: (virtual.error ?? selector.error)!.message };
  else if (!rootAccount || !selector.data || selector.isFetching) route = { kind: "loading" };
  else if (isAddressEqual(selector.data.unlocker, zeroAddress)) route = { kind: "normal" };
  else {
    if (
      !parameters.capability &&
      info.error &&
      (configured === true || Boolean(capability)) &&
      (info.error.kind === "rpc" ||
        (info.error.kind === "api" && (info.error.status === 0 || (info.error.status ?? 0) >= 500)))
    )
      route = { kind: "delayed", rootAccount, unlocker: selector.data.unlocker, delay: selector.data.delay };
    else if (!parameters.capability && !known && info.error) route = { kind: "error", message: info.error.message };
    else if (!parameters.capability && !known && info.isFetching) route = { kind: "loading" };
    else if (capability) {
      const chain = config.getChainConfig(chainId);
      if (
        Number(capability.requestDomain.chainId) !== chainId ||
        !isAddressEqual(capability.requestDomain.verifyingContract, chain.addresses.accountLayerAddress)
      )
        route = { kind: "error", message: "Timelock provider belongs to another deployment." };
      else if (policy.error) route = { kind: "error", message: policy.error.message };
      else if (!policy.data || policy.isFetching) route = { kind: "loading" };
      else if (!policy.data.ready || !isAddressEqual(capability.unlocker, selector.data.unlocker))
        route = { kind: "error", message: "The on-chain selector policy does not match the provider." };
      else route = { kind: "approval", rootAccount, capability };
    } else if (solver.id !== "enigma" || info.isSuccess)
      route = { kind: "error", message: "Timelock provider metadata is unavailable or not configured." };
    else route = { kind: "loading" };
  }
  /** Execute the selected normal/approval branch once, or return the delayed option to the UI. */
  async function run<T extends { receipt?: { status: string } }>(actions: {
    normal: () => Promise<T>;
    protected: (authorization: TimelockAuthorization) => Promise<T>;
    deadline?: bigint;
    onApproval?: (approval: ValidatedTimelockApproval) => void | Promise<void>;
  }): Promise<
    { kind: "submitted"; result: T } | { kind: "delayed"; rootAccount: Address; unlocker: Address; delay: bigint }
  > {
    if (attempts.current.has(attemptKey)) throw new Error("A prior protected operation requires reconciliation.");
    if (route.kind === "delayed") return route;
    if (route.kind === "normal") return { kind: "submitted", result: await actions.normal() };
    if (route.kind !== "approval")
      throw new Error(route.kind === "error" ? route.message : "Timelock routing is still loading.");
    if (actions.deadline === undefined) throw new Error("An approval request deadline is required.");
    attempts.current.set(attemptKey, "pending");
    refresh((value) => value + 1);
    let issued = false;
    try {
      const provider = parameters.provider ?? createHttpTimelockApprovalProvider({ baseUrl: solver.url });
      const authorization: TimelockAuthorization = {
        capability: route.capability,
        provider: {
          requestApproval: async (request, options) => {
            if (!mounted.current || currentScope.current !== scope)
              throw new Error("Account or deployment changed before requesting approval.");
            try {
              return await provider.requestApproval(request, options);
            } catch (error) {
              if (!parameters.provider)
                void refreshTimelockInfoAfterUnavailable(queryClient, config, chainId, solver.id, error);
              throw error;
            }
          },
        },
        deadline: actions.deadline,
        onApproval: async (approval) => {
          issued = true;
          await actions.onApproval?.(approval);
          if (!mounted.current || currentScope.current !== scope)
            throw new Error("Account or deployment changed; reconcile the previous approval.");
        },
      };
      if (!mounted.current || currentScope.current !== scope)
        throw new Error("Account or deployment changed before execution.");
      const result = await actions.protected(authorization);
      if (result.receipt?.status === "success") attempts.current.delete(attemptKey);
      else attempts.current.set(attemptKey, "reconcile");
      return { kind: "submitted", result };
    } catch (error) {
      const rejected =
        error instanceof SymmioRequestError &&
        error.kind === "api" &&
        (error.timelock?.knownCode === 3703 || error.timelock?.knownCode === 3704);
      if (!issued && rejected) attempts.current.delete(attemptKey);
      else attempts.current.set(attemptKey, "reconcile");
      throw error;
    } finally {
      refresh((value) => value + 1);
    }
  }
  function clearReconciledAttempt() {
    if (attempts.current.get(attemptKey) === "pending") throw new Error("The operation is still pending.");
    attempts.current.delete(attemptKey);
    refresh((value) => value + 1);
  }
  if (attempts.current.has(attemptKey)) route = { kind: "reconciliation" };
  return {
    route,
    rootAccount,
    selector,
    policy,
    info,
    virtual,
    run,
    attempt: attempts.current.get(attemptKey),
    clearReconciledAttempt,
  };
}
