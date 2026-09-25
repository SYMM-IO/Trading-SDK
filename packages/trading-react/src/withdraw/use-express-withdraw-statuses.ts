"use client";

import {
  getExpressWithdrawStatusQueryOptions,
  type ConfigParameter,
  type ExpressWithdrawStatus,
  type WithdrawRequest,
} from "@symmio/trading-core";
import { useQueries } from "@tanstack/react-query";
import { isAddressEqual, type Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { getExpressWithdrawStatusRefetchInterval } from "./express-withdraw-status-polling";

/** Service status associated with one discovered on-chain Express request. */
export interface ExpressWithdrawStatusEntry {
  /** Active on-chain request being reconciled. */
  request: WithdrawRequest;
  /** Latest service/provider status, once the first status read succeeds. */
  status?: ExpressWithdrawStatus;
  /** Normalized status-read failure, or `null` while no failure is present. */
  error: SymmioRequestError | null;
  /** Whether this request's service status is currently being fetched. */
  isFetching: boolean;
}

/** Parameters for {@link useExpressWithdrawStatuses}. */
export type UseExpressWithdrawStatusesParameters = ConfigParameter & {
  /** Active on-chain requests to match against the configured Express provider. */
  requests: readonly WithdrawRequest[];
  /** Target chain; defaults to the connected SYMMIO chain. */
  chainId?: number;
  /** Set `false` to disable all service status reads. @default true */
  enabled?: boolean;
};

/** Combined state returned by {@link useExpressWithdrawStatuses}. */
export interface UseExpressWithdrawStatusesReturnType {
  /** Configured-provider requests paired with their individual service states. */
  entries: readonly ExpressWithdrawStatusEntry[];
  /** Whether any discovered request is waiting for its first status result. */
  isLoading: boolean;
  /** Whether any discovered request is currently fetching. */
  isFetching: boolean;
}

function belongsToProvider(request: WithdrawRequest, providerAddress: Address): boolean {
  return (
    isAddressEqual(request.provider, providerAddress) ||
    request.parts.some((part) => isAddressEqual(part.expressProvider, providerAddress))
  );
}

/**
 * Reconcile active on-chain requests with the configured Express service.
 *
 * Requests for classic withdrawals or another provider are ignored. Matching
 * requests are polled independently until payout or a terminal failure, so a
 * consumer can rebuild active Express progress after a page refresh.
 *
 * @param parameters - Active requests, optional chain/config, and enable flag.
 * @returns Matching requests paired with their service status query state.
 *
 * @example
 * ```tsx
 * const pending = usePendingWithdrawRequests({ user: subAccount });
 * const express = useExpressWithdrawStatuses({ requests: pending.data ?? [] });
 * ```
 */
export function useExpressWithdrawStatuses(
  parameters: UseExpressWithdrawStatusesParameters,
): UseExpressWithdrawStatusesReturnType {
  const config = useSymmioConfig(parameters);
  const connectedChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? connectedChainId;
  const providerAddress = config.getChainConfig(chainId).expressWithdraw?.providerAddress;
  const requests = providerAddress
    ? parameters.requests.filter((request) => belongsToProvider(request, providerAddress))
    : [];

  const results = useQueries({
    queries: requests.map((request) => {
      const options = getExpressWithdrawStatusQueryOptions(config, {
        user: request.user,
        requestId: request.id,
        chainId,
      });
      return {
        ...options,
        enabled: parameters.enabled !== false,
        refetchInterval: getExpressWithdrawStatusRefetchInterval,
        queryFn: async () => {
          try {
            return await options.queryFn();
          } catch (err) {
            throw normalizeSymmError(err);
          }
        },
      };
    }),
  });

  return {
    entries: requests.map((request, index) => {
      const result = results[index];
      return {
        request,
        ...(result?.data === undefined ? {} : { status: result.data }),
        error: (result?.error as SymmioRequestError | null | undefined) ?? null,
        isFetching: result?.isFetching ?? false,
      };
    }),
    isLoading: results.some((result) => result.isLoading),
    isFetching: results.some((result) => result.isFetching),
  };
}
