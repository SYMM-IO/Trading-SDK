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
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";

/** Execute named Core calls atomically, optionally with per-call timelock authorizations. */
export function useExecuteAccountCalls(
  parameters: WriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, ExecuteAccountCallsParameters> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const client = useQueryClient();
  const base = executeAccountCallsMutationOptions(config);
  return useMutation({
    mutationKey: base.mutationKey,
    retry: false,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const account = variables.account;
        const affected = variables.calls.map((call) =>
          encodeFunctionData({ abi: symmioAbi as Abi, functionName: call.functionName, args: call.args }),
        );
        const hash = await base.mutationFn({ ...variables, chainId: resolvedChainId });
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
        return result;
      } catch (error) {
        throw variables.timelock ? normalizeProtectedWriteError(error, variables.timelock) : normalizeSymmError(error);
      }
    },
  });
}
