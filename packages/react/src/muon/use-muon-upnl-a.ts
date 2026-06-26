"use client";

import {
  getMuonUpnlA,
  type ConfigParameter,
  type GetMuonUpnlAParameters,
  type GetMuonUpnlAReturnType,
} from "@theoldvarorg/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonUpnlA}: an optional `config` override. The partyA
 * is passed as the mutation `variables`.
 */
export type UseMuonUpnlAParameters = ConfigParameter;

/** Return type of {@link useMuonUpnlA}. */
export type UseMuonUpnlAReturnType = UseMutationResult<
  GetMuonUpnlAReturnType,
  SymmioRequestError,
  GetMuonUpnlAParameters
>;

/**
 * Fetch a fresh Muon `uPnl_A` attestation for a partyA, on demand, normalized to
 * typed fields (uPnl, notional, quote/symbol ids, signature envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are timestamped
 * and short-lived, so they are fetched on an explicit action, not eagerly on
 * mount. Call `mutateAsync({ partyA })`. `chainId` and the `symmio` address are
 * resolved from the connected chain's config. For the contract-ready
 * `SingleUpnlSig` that `removeMargin` needs, use {@link useDeallocateUpnlSig}.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonUpnlA();
 * const a = await mutateAsync({ partyA: "0xva…" });
 * ```
 */
export function useMuonUpnlA(parameters: UseMuonUpnlAParameters = {}): UseMuonUpnlAReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonUpnlAReturnType, SymmioRequestError, GetMuonUpnlAParameters>({
    mutationKey: ["getMuonUpnlA"],
    mutationFn: async (variables) => {
      try {
        return await getMuonUpnlA(config, {
          partyA: variables.partyA,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
