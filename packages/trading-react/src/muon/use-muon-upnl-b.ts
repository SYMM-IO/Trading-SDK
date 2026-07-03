"use client";

import {
  getMuonUpnlB,
  type ConfigParameter,
  type GetMuonUpnlBParameters,
  type GetMuonUpnlBReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonUpnlB}: an optional `config` override. The partyB
 * and partyA are passed as the mutation `variables`.
 */
export type UseMuonUpnlBParameters = ConfigParameter;

/** Return type of {@link useMuonUpnlB}. */
export type UseMuonUpnlBReturnType = UseMutationResult<
  GetMuonUpnlBReturnType,
  SymmioRequestError,
  GetMuonUpnlBParameters
>;

/**
 * Fetch a fresh Muon `uPnl_B` attestation for a partyB against a partyA, on
 * demand, normalized to typed fields (uPnl, notional, quote ids, signature
 * envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are timestamped
 * and short-lived, so they are fetched on an explicit action, not eagerly on
 * mount. Call `mutateAsync({ partyB, partyA })`. `chainId` and the `symmio`
 * address are resolved from the connected chain's config. A partyB's uPnL against
 * a partyA is used in `lockQuote` solvency validation.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonUpnlB();
 * const b = await mutateAsync({ partyB: "0xpb…", partyA: "0xva…" });
 * ```
 */
export function useMuonUpnlB(parameters: UseMuonUpnlBParameters = {}): UseMuonUpnlBReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonUpnlBReturnType, SymmioRequestError, GetMuonUpnlBParameters>({
    mutationKey: ["getMuonUpnlB"],
    mutationFn: async (variables) => {
      try {
        return await getMuonUpnlB(config, {
          partyB: variables.partyB,
          partyA: variables.partyA,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
