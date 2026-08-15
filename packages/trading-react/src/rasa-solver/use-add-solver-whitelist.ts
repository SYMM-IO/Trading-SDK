"use client";

import {
  addSolverWhitelistMutationOptions,
  type AddSolverWhitelistParameters,
  type AddSolverWhitelistReturnType,
  type ConfigParameter,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useAddSolverWhitelist}. */
export type UseAddSolverWhitelistParameters = ConfigParameter;

/** Return type of {@link useAddSolverWhitelist}. */
export type UseAddSolverWhitelistReturnType = UseMutationResult<
  AddSolverWhitelistReturnType,
  SymmioRequestError,
  AddSolverWhitelistParameters
>;

/**
 * Add an address to the solver's whitelist via the Rasa-only
 * `/add-sub-address-in-whitelist` endpoint. A mutation — it changes
 * solver-side state. Fails with `UNSUPPORTED_BY_SOLVER` when the resolved
 * solver is not a `rasa` solver.
 *
 * @example
 * ```tsx
 * const { mutate } = useAddSolverWhitelist();
 * <button onClick={() => mutate({ address })}>Whitelist</button>
 * ```
 */
export function useAddSolverWhitelist(
  parameters: UseAddSolverWhitelistParameters = {},
): UseAddSolverWhitelistReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const base = addSolverWhitelistMutationOptions(config);

  return useMutation<AddSolverWhitelistReturnType, SymmioRequestError, AddSolverWhitelistParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
