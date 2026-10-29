"use client";

import {
  accountLayerAbi,
  encodeProtectedFunction,
  encodeTimelockedCoreCall,
  executeProtectedFunctionMutationOptions,
  INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS,
  INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS,
  symmioAbi,
  type ExecuteProtectedFunctionParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { encodeFunctionData, getAbiItem, type Abi, type AbiFunction } from "viem";
import { normalizeProtectedWriteError } from "../errors/normalize-protected-write-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { invalidateTimelockExecutionReads } from "../gasless/invalidate-relay-reads";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";

/** Return the SDK encoder for validating named function input before an action. */
export function useProtectedFunctionEncoder(): typeof encodeProtectedFunction {
  return encodeProtectedFunction;
}

/** The documented protected functions and their ABI inputs, for SDK-driven forms. */
export function useProtectedFunctionCatalog(): readonly {
  target: "core" | "account-layer";
  name: string;
  inputs: AbiFunction["inputs"];
}[] {
  return [
    ...INSTANT_OPEN_TIMELOCK_CORE_FUNCTIONS.map((name) => ({
      target: "core" as const,
      name,
      inputs: (getAbiItem({ abi: symmioAbi as Abi, name }) as AbiFunction).inputs,
    })),
    ...INSTANT_OPEN_TIMELOCK_ACCOUNT_LAYER_FUNCTIONS.map((name) => ({
      target: "account-layer" as const,
      name,
      inputs: (getAbiItem({ abi: accountLayerAbi as Abi, name }) as AbiFunction).inputs,
    })),
  ];
}

/** Execute any documented protected function with ABI-typed arguments and explicit authorization. */
export function useProtectedFunction(
  parameters: WriteParameters = {},
): UseMutationResult<WriteResult, SymmioRequestError, ExecuteProtectedFunctionParameters> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const client = useQueryClient();
  const base = executeProtectedFunctionMutationOptions(config);
  return useMutation({
    mutationKey: base.mutationKey,
    retry: false,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({ ...variables, chainId: resolvedChainId });
        return await resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
      } catch (error) {
        throw normalizeProtectedWriteError(error, variables.timelock);
      }
    },
    onSuccess: (result, variables) => {
      if (!result.receipt) return;
      const abi = variables.target === "core" ? symmioAbi : accountLayerAbi;
      const raw = encodeFunctionData({ abi: abi as Abi, functionName: variables.functionName, args: variables.args });
      const inner = variables.target === "core" ? encodeTimelockedCoreCall(variables.account, raw) : raw;
      invalidateTimelockExecutionReads(
        client,
        { configKey: config.getChainConfigKey(variables.chainId ?? chainId) },
        inner,
      );
    },
  });
}
