"use client";

import {
  getSolverRevenueQueryOptions,
  type ConfigParameter,
  type GetSolverRevenueOptions,
  type GetSolverRevenueReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSolverRevenue}: the core query options plus an optional `config`. */
export type UseSolverRevenueParameters = GetSolverRevenueOptions & ConfigParameter;

/** Return type of {@link useSolverRevenue}: revenue totals for the window. */
export type UseSolverRevenueReturnType = UseQueryResult<GetSolverRevenueReturnType, SymmioRequestError>;

/**
 * Read one market's revenue totals from the connected chain's solver.
 *
 * The result splits into a hedger-fee share and a funding share whose sum is
 * `totalRevenue`, all as plain dollar numbers. `recordCount` separates "this
 * window earned nothing" from "there is no data for this window".
 *
 * `symbolId` is required: the current solver generation serves revenue **per
 * market only** — the protocol-wide `/revenue` aggregate no longer exists.
 *
 * Enigma-only; a rasa-kind solver fails with `UNSUPPORTED_BY_SOLVER`. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const lifetime = useSolverRevenue({ symbolId: 1 });
 * const day = useSolverRevenue({ symbolId: 1, timeRange: "24h" });
 * ```
 */
export function useSolverRevenue(parameters: UseSolverRevenueParameters): UseSolverRevenueReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSolverRevenueQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseSolverRevenueReturnType;
}
