"use client";

import {
  getRevocationCooldownQueryOptions,
  type ConfigParameter,
  type GetRevocationCooldownOptions,
  type GetRevocationCooldownReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useRevocationCooldown}: an optional chain id and
 * TanStack `query` overrides, plus an optional `config`.
 */
export type UseRevocationCooldownParameters = GetRevocationCooldownOptions & ConfigParameter;

/** Return type of {@link useRevocationCooldown}. */
export type UseRevocationCooldownReturnType = UseQueryResult<GetRevocationCooldownReturnType, SymmioRequestError>;

/**
 * Read the Instant Layer's delegation revocation cooldown, in seconds.
 *
 * This is the delay between {@link useInitiateRevokeDelegation} and the moment
 * the delegation stops being enforced — surface it so a UI can tell the user
 * how long a revoked key stays live.
 *
 * @example
 * ```tsx
 * const { data: cooldownSeconds } = useRevocationCooldown();
 * ```
 */
export function useRevocationCooldown(
  parameters: UseRevocationCooldownParameters = {},
): UseRevocationCooldownReturnType {
  const config = useSymmioConfig(parameters);
  const options = getRevocationCooldownQueryOptions(config, parameters);

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseRevocationCooldownReturnType;
}
