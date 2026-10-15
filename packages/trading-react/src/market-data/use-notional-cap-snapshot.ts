"use client";
import {
  getNotionalCapSnapshotQueryOptions,
  type ConfigParameter,
  type GetNotionalCapSnapshotOptions,
  type GetNotionalCapSnapshotReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
/** Parameters for useNotionalCapSnapshot. */
export type UseNotionalCapSnapshotParameters = GetNotionalCapSnapshotOptions & ConfigParameter;
/** React query result. */
export type UseNotionalCapSnapshotReturnType = UseQueryResult<GetNotionalCapSnapshotReturnType, SymmioRequestError>;
/** Read NotionalCapSnapshot; polling is opt-in through query.refetchInterval. */
export function useNotionalCapSnapshot(
  parameters: UseNotionalCapSnapshotParameters = {},
): UseNotionalCapSnapshotReturnType {
  const config = useSymmioConfig(parameters),
    chainId = useSymmioChainId();
  const options = getNotionalCapSnapshotQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseNotionalCapSnapshotReturnType;
}
