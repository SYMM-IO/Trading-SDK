"use client";
import {
  authenticateSolverMutationOptions,
  type AuthenticateSolverParameters,
  type ConfigParameter,
  type SolverAuthentication,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Config override for {@link useAuthenticateSolver}. */
export type UseAuthenticateSolverParameters = ConfigParameter;
/** Request state and mutation controls for {@link useAuthenticateSolver}. */
export type UseAuthenticateSolverReturnType = UseMutationResult<
  SolverAuthentication,
  SymmioRequestError,
  AuthenticateSolverParameters
>;

/**
 * Exchange a consumer-signed legacy challenge; the host owns consent, token storage and refresh.
 * @param parameters - Optional SDK config override.
 * @returns Mutation state; call mutateAsync with the complete core action inputs.
 * @example const request = useAuthenticateSolver();
 */
export function useAuthenticateSolver(
  parameters: UseAuthenticateSolverParameters = {},
): UseAuthenticateSolverReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = authenticateSolverMutationOptions(config);
  return useMutation({
    ...options,
    mutationFn: async (variables: AuthenticateSolverParameters) => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  });
}
