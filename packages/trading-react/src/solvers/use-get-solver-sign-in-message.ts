"use client";
import {
  getSolverSignInMessageMutationOptions,
  type ConfigParameter,
  type GetSolverSignInMessageParameters,
  type SolverSignInChallenge,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Config override for {@link useGetSolverSignInMessage}. */
export type UseGetSolverSignInMessageParameters = ConfigParameter;
/** Request state and mutation controls for {@link useGetSolverSignInMessage}. */
export type UseGetSolverSignInMessageReturnType = UseMutationResult<
  SolverSignInChallenge,
  SymmioRequestError,
  GetSolverSignInMessageParameters
>;

/**
 * Fetch an unsigned legacy sign-in challenge on demand; the host owns consent, token storage and refresh.
 * @param parameters - Optional SDK config override.
 * @returns Mutation state; call mutateAsync with the complete core action inputs.
 * @example const request = useGetSolverSignInMessage();
 */
export function useGetSolverSignInMessage(
  parameters: UseGetSolverSignInMessageParameters = {},
): UseGetSolverSignInMessageReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSolverSignInMessageMutationOptions(config);
  return useMutation({
    ...options,
    mutationFn: async (variables: GetSolverSignInMessageParameters) => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  });
}
