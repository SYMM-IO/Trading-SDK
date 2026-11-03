"use client";

import {
  createHttpTimelockApprovalProvider,
  getSelectorTimelockQueryOptions,
  getSolverInfoQueryOptions,
  getTimelockPolicyQueryOptions,
  getVirtualAccountQueryOptions,
  INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS,
  INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS,
  INSTANT_OPEN_TIMELOCK_SELECTORS,
  SymmError,
  TimelockApprovalHttpError,
  TimelockBatchExecutionError,
  TimelockExecutionError,
  type Config,
  type GetSolverInfoData,
  type TimelockApprovalCapability,
  type TimelockAuthorization,
  type TimelockBatchAuthorization,
} from "@symmio/trading-core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { isAddressEqual, UserRejectedRequestError, zeroAddress, type Address } from "viem";
import { useConnection } from "wagmi";
import {
  refreshTimelockInfoAfterUnavailable,
  rememberTimelockCapability,
  timelockCapabilityKey,
} from "../solvers/timelock-capability-cache";
import type { AutomaticTimelockWriteParameters } from "../transactions/write-types";
import {
  automaticAttemptKey,
  deploymentHasAutomaticAttempt,
  finishAutomaticAttempt,
  reserveAutomaticAttempt,
} from "./automatic-timelock-attempt";

/** A wallet rejection is definitive only before any submission evidence exists. */
function isUnsubmittedExecutionRejection(error: unknown): boolean {
  if (!(error instanceof TimelockExecutionError || error instanceof TimelockBatchExecutionError)) return false;
  let current: unknown = error;
  let rejected = false;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const item = current as Record<string, unknown>;
    if (
      item.hash ||
      item.transactionHash ||
      item.txHash ||
      item.broadcastHash ||
      item.requestId ||
      item.request_id ||
      item.idempotencyKey ||
      item.idempotency_key ||
      item.code === "GASLESS_SUBMIT_UNCONFIRMED" ||
      item.responseData
    )
      return false;
    if (current instanceof UserRejectedRequestError) rejected = true;
    current = item.cause;
  }
  return rejected && current == null;
}

/** Resolve an automatic authorization once per mutation variables object. */
export function useAutomaticTimelock(
  config: Config,
  options: AutomaticTimelockWriteParameters["automaticTimelock"] = true,
  boundAccount?: Address,
) {
  const client = useQueryClient();
  const connection = useConnection();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const attempts = useRef(new WeakMap<object, Map<string, Promise<TimelockAuthorization | undefined>>>());
  const batches = useRef(new WeakMap<object, Map<string, Promise<TimelockBatchAuthorization | undefined>>>());
  const active = useRef(
    new WeakMap<object, { token: object; key?: ReturnType<typeof automaticAttemptKey>; issued: number }>(),
  );
  const supplied = typeof options === "object" ? options : undefined;
  const fingerprint = supplied
    ? JSON.stringify([
        supplied.capability.unlocker.toLowerCase(),
        supplied.capability.minTimelockDelaySeconds,
        supplied.capability.validitySeconds,
        supplied.capability.requestDomain.name,
        supplied.capability.requestDomain.version,
        String(supplied.capability.requestDomain.chainId),
        supplied.capability.requestDomain.verifyingContract.toLowerCase(),
        supplied.deadline?.toString(),
      ])
    : String(options);
  const providerIdentity = supplied?.provider;
  const walletScope = `${connection.chainId ?? ""}:${connection.address?.toLowerCase() ?? ""}:${boundAccount?.toLowerCase() ?? ""}`;
  const scope = useRef({ config, fingerprint, providerIdentity, walletScope, revision: 0 });
  if (
    scope.current.config !== config ||
    scope.current.fingerprint !== fingerprint ||
    scope.current.providerIdentity !== providerIdentity ||
    scope.current.walletScope !== walletScope
  ) {
    scope.current = { config, fingerprint, providerIdentity, walletScope, revision: scope.current.revision + 1 };
  }
  const operationScopes = useRef(new WeakMap<object, string>());

  function checkOperationScope(variables: object, parameters: { account: Address; chainId: number }) {
    if (!mounted.current)
      throw new SymmError(
        "validation",
        "TIMELOCK_RECONCILIATION_REQUIRED",
        "The operation's context was unmounted. Reconcile the previous attempt before continuing.",
      );
    const previous = operationScopes.current.get(variables);
    const current = `${scope.current.revision}:${parameters.chainId}:${parameters.account.toLowerCase()}`;
    if (previous !== undefined && previous !== current) {
      throw new SymmError(
        "validation",
        "TIMELOCK_RECONCILIATION_REQUIRED",
        "The timelock configuration changed during this operation. Reconcile the previous attempt before continuing.",
      );
    }
    operationScopes.current.set(variables, current);
  }

  async function guard(variables: object, parameters: { account: Address; chainId: number }) {
    checkOperationScope(variables, parameters);
    const chain = config.getChainConfig(parameters.chainId);
    if (!deploymentHasAutomaticAttempt(client, parameters.chainId, chain.addresses.accountLayerAddress)) return;
    const virtual = await client.fetchQuery({
      ...getVirtualAccountQueryOptions(config, { chainId: parameters.chainId, account: parameters.account }),
      retry: false,
    });
    checkOperationScope(variables, parameters);
    const root = virtual.isExists ? virtual.parentAccount : parameters.account;
    const existing = client.getQueryData(
      automaticAttemptKey(parameters.chainId, chain.addresses.accountLayerAddress, root),
    );
    if (existing)
      throw new SymmError(
        "validation",
        "TIMELOCK_RECONCILIATION_REQUIRED",
        "A previous timelock operation is pending or requires reconciliation.",
      );
  }

  function resolve(
    variables: object,
    parameters: {
      account: Address;
      chainId: number;
      functionName: string;
      slot?: number;
      explicit?: TimelockAuthorization;
    },
  ) {
    if (options === false && !operationScopes.current.has(variables)) return Promise.resolve(undefined);
    checkOperationScope(variables, parameters);
    if (parameters.explicit) return Promise.resolve(parameters.explicit);
    if (options === false) return Promise.resolve(undefined);
    const key = `${parameters.chainId}:${parameters.account.toLowerCase()}:${parameters.functionName}:${parameters.slot ?? "single"}`;
    let perOperation = attempts.current.get(variables);
    if (!perOperation) {
      perOperation = new Map();
      attempts.current.set(variables, perOperation);
    }
    const prior = perOperation.get(key);
    if (prior) return prior;
    const task = (async () => {
      await guard(variables, parameters);
      const names: readonly string[] = [
        ...INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS,
        ...INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS,
      ];
      const index = names.indexOf(parameters.functionName);
      if (index < 0) return undefined;
      const chain = config.getChainConfig(parameters.chainId);
      const solver = config.getSolver({ chainId: parameters.chainId });
      if (chain.timelockSupported === false || solver.capabilities?.timelockApproval === false) return undefined;
      const infoOptions = getSolverInfoQueryOptions(config, { chainId: parameters.chainId, solverId: solver.id });
      const capabilityKey = timelockCapabilityKey(config, parameters.chainId, solver.id);
      async function selectorIsUnlocked() {
        const virtual = await client.fetchQuery({
          ...getVirtualAccountQueryOptions(config, { chainId: parameters.chainId, account: parameters.account }),
          retry: false,
          staleTime: 0,
        });
        const root = virtual.isExists ? virtual.parentAccount : parameters.account;
        const selector = await client.fetchQuery({
          ...getSelectorTimelockQueryOptions(config, {
            chainId: parameters.chainId,
            account: root,
            selector: INSTANT_OPEN_TIMELOCK_SELECTORS[index]!,
          }),
          retry: false,
          staleTime: 0,
        });
        checkOperationScope(variables, parameters);
        return isAddressEqual(selector.unlocker, zeroAddress);
      }
      if (!supplied && solver.id !== "enigma") {
        if (solver.capabilities?.timelockApproval !== true || (await selectorIsUnlocked())) return undefined;
        throw new SymmError(
          "config",
          "TIMELOCK_PROVIDER_REQUIRED",
          "Supply an explicit timelock authorization for this solver.",
        );
      }
      let capability = supplied?.capability ?? client.getQueryData<TimelockApprovalCapability>(capabilityKey);
      if (!capability && !supplied) {
        capability = client.getQueryData<GetSolverInfoData>(infoOptions.queryKey)?.timelockApproval;
        rememberTimelockCapability(client, capabilityKey, capability);
      }
      if (!capability) {
        try {
          capability = (await client.fetchQuery({ ...infoOptions, retry: false, staleTime: 0 })).timelockApproval;
          rememberTimelockCapability(client, capabilityKey, capability);
        } catch (error) {
          // A confirmed unlocked selector does not depend on the approval service.
          // If either chain read fails, retain the original discovery failure.
          try {
            if (await selectorIsUnlocked()) return undefined;
          } catch {
            // Preserve the original failure and do not assume the selector is unlocked.
          }
          throw error;
        }
      }
      checkOperationScope(variables, parameters);
      if (!capability) {
        if (await selectorIsUnlocked()) return undefined;
        throw new SymmError(
          "config",
          "TIMELOCK_PROVIDER_REQUIRED",
          "The selector is timelocked, but the solver did not provide timelock metadata.",
        );
      }
      const policyOptions = getTimelockPolicyQueryOptions(config, {
        account: parameters.account,
        chainId: parameters.chainId,
        solverId: solver.id,
        capability,
        selectors: [INSTANT_OPEN_TIMELOCK_SELECTORS[index]!],
      });
      const policy = await client.fetchQuery({ ...policyOptions, retry: false, staleTime: 0 });
      checkOperationScope(variables, parameters);
      if (policy.selectors[0]?.status === "missing") return undefined;
      if (!policy.ready)
        throw new SymmError(
          "validation",
          "TIMELOCK_POLICY_NOT_READY",
          "The account's timelock policy does not match the solver.",
        );
      const block = await config.getClient({ chainId: parameters.chainId }).getBlock();
      checkOperationScope(variables, parameters);
      const provider = supplied?.provider ?? createHttpTimelockApprovalProvider({ baseUrl: solver.url });
      let attempt = active.current.get(variables);
      if (!attempt) {
        attempt = { token: {}, issued: 0 };
        active.current.set(variables, attempt);
      }
      const currentAttempt = attempt;
      const key = automaticAttemptKey(parameters.chainId, chain.addresses.accountLayerAddress, policy.rootAccount);
      return {
        capability,
        provider: {
          requestApproval: async (request, requestOptions) => {
            checkOperationScope(variables, parameters);
            reserveAutomaticAttempt(client, key, currentAttempt.token);
            currentAttempt.key = key;
            try {
              const response = await provider.requestApproval(request, requestOptions);
              currentAttempt.issued += 1;
              return response;
            } catch (error) {
              if (!supplied?.provider)
                void refreshTimelockInfoAfterUnavailable(client, config, parameters.chainId, solver.id, error);
              throw error;
            }
          },
        },
        deadline: supplied?.deadline ?? block.timestamp + 300n,
        onApproval: async (approval) => {
          await supplied?.onApproval?.(approval);
          checkOperationScope(variables, parameters);
        },
      } satisfies TimelockAuthorization;
    })();
    perOperation.set(key, task);
    return task;
  }
  function batch(
    variables: object,
    parameters: { account: Address; chainId: number; functionNames: readonly string[] },
  ) {
    checkOperationScope(variables, parameters);
    const key = `${parameters.chainId}:${parameters.account.toLowerCase()}:${parameters.functionNames.join(",")}`;
    let perOperation = batches.current.get(variables);
    if (!perOperation) {
      perOperation = new Map();
      batches.current.set(variables, perOperation);
    }
    const prior = perOperation.get(key);
    if (prior) return prior;
    const task = Promise.all(
      parameters.functionNames.map((functionName, slot) => resolve(variables, { ...parameters, functionName, slot })),
    ).then((calls) => (calls.some(Boolean) ? { calls } : undefined));
    perOperation.set(key, task);
    return task;
  }
  function finish(variables: object, result: { receipt?: { status: string } }) {
    const attempt = active.current.get(variables);
    if (attempt?.key) finishAutomaticAttempt(client, attempt.key, attempt.token, result.receipt?.status === "success");
  }
  function fail(variables: object, error: unknown) {
    const attempt = active.current.get(variables);
    if (!attempt?.key) return;
    const rejections: Record<string, number> = {
      "3700": 400,
      "3701": 400,
      "3702": 400,
      "3703": 400,
      "3704": 400,
      "3705": 429,
      "3706": 503,
      "3707": 503,
      "3709": 403,
      "3710": 400,
    };
    const rejected = error instanceof TimelockApprovalHttpError && rejections[error.code] === error.status;
    finishAutomaticAttempt(
      client,
      attempt.key,
      attempt.token,
      (rejected && attempt.issued === 0) || isUnsubmittedExecutionRejection(error),
    );
  }
  return Object.assign(resolve, { batch, finish, fail, guard });
}
