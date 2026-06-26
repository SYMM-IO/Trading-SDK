"use client";

import {
  getDeallocateUpnlSig,
  type ConfigParameter,
  type GetDeallocateUpnlSigParameters,
  type GetDeallocateUpnlSigReturnType,
} from "@theoldvarorg/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useDeallocateUpnlSig}: an optional `config` override. The
 * virtual account is passed as the mutation `variables`.
 */
export type UseDeallocateUpnlSigParameters = ConfigParameter;

/** Return type of {@link useDeallocateUpnlSig}. */
export type UseDeallocateUpnlSigReturnType = UseMutationResult<
  GetDeallocateUpnlSigReturnType,
  SymmioRequestError,
  GetDeallocateUpnlSigParameters
>;

/**
 * Fetch a fresh Muon uPnL (`uPnl_A`) attestation for a virtual account, on demand.
 *
 * Modeled as a **mutation** rather than a query: the signature is timestamped and
 * short-lived, so it must be fetched at submit time, not eagerly on mount. Call
 * `mutateAsync({ virtualAccount })` to get the contract-ready `SingleUpnlSig` to
 * pass to {@link useRemoveMargin} (or the core `removeMargin`). `useRemoveMargin`
 * already does this for you — reach for this hook only when you need the raw
 * signature (or the attested uPnL) on its own.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useDeallocateUpnlSig();
 * const upnlSig = await mutateAsync({ virtualAccount: "0xva…" });
 * ```
 */
export function useDeallocateUpnlSig(parameters: UseDeallocateUpnlSigParameters = {}): UseDeallocateUpnlSigReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetDeallocateUpnlSigReturnType, SymmioRequestError, GetDeallocateUpnlSigParameters>({
    mutationKey: ["getDeallocateUpnlSig"],
    mutationFn: async (variables) => {
      try {
        return await getDeallocateUpnlSig(config, {
          virtualAccount: variables.virtualAccount,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
