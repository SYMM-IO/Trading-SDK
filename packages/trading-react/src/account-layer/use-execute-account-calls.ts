"use client";

import {
  encodeTimelockedCoreCall,
  executeAccountCallsMutationOptions,
  symmioAbi,
  type ExecuteAccountCallsParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { encodeFunctionData, type Abi } from "viem";
import { normalizeProtectedWriteError } from "../errors/normalize-protected-write-error";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { invalidateTimelockExecutionReads } from "../gasless/invalidate-relay-reads";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type AutomaticTimelockWriteParameters, type WriteResult } from "../transactions";
import { useAutomaticTimelock } from "./use-automatic-timelock";

/** Execute named Core calls atomically, optionally with per-call timelock authorizations. */
export function useExecuteAccountCalls(
  parameters: AutomaticTimelockWriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, ExecuteAccountCallsParameters> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const client = useQueryClient();
  const automaticTimelock = useAutomaticTimelock(config, parameters.automaticTimelock);
  const base = executeAccountCallsMutationOptions(config);
  return useMutation({
    mutationKey: base.mutationKey,
    retry: false,
    mutationFn: async (variables) => {
      let authorization = variables.timelock;
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const account = variables.account;
        const affected = variables.calls.map((call) =>
          encodeFunctionData({ abi: symmioAbi as Abi, functionName: call.functionName, args: call.args }),
        );
        authorization ??= await automaticTimelock.batch(variables, {
          account,
          chainId: resolvedChainId,
          functionNames: variables.calls.map((call) => call.functionName),
        });
        const hash = await base.mutationFn({
          ...variables,
          chainId: resolvedChainId,
          ...(authorization ? { timelock: authorization } : {}),
        });
        const result = await resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
        if (result.receipt) {
          const scope = { configKey: config.getChainConfigKey(resolvedChainId) };
          for (const raw of affected)
            invalidateTimelockExecutionReads(client, scope, encodeTimelockedCoreCall(account, raw));
        }
        automaticTimelock.finish(variables, result);
        return result;
      } catch (error) {
        automaticTimelock.fail(variables, error);
        throw authorization ? normalizeProtectedWriteError(error, authorization) : normalizeSymmError(error);
      }
    },
  });
}
