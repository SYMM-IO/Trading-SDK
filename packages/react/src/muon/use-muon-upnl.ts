"use client";

import {
  getMuonUpnl,
  type ConfigParameter,
  type GetMuonUpnlParameters,
  type GetMuonUpnlReturnType,
} from "@symm-frontier/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonUpnl}: an optional `config` override. The partyB
 * and partyA are passed as the mutation `variables`.
 */
export type UseMuonUpnlParameters = ConfigParameter;

/** Return type of {@link useMuonUpnl}. */
export type UseMuonUpnlReturnType = UseMutationResult<GetMuonUpnlReturnType, SymmioRequestError, GetMuonUpnlParameters>;

/**
 * Fetch a fresh Muon `uPnl` attestation for a partyB / partyA pair, on demand,
 * normalized to typed fields (combined uPnL with a per-party breakdown plus the
 * signature envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are timestamped
 * and short-lived, so they are fetched on an explicit action, not eagerly on
 * mount. Call `mutateAsync({ partyB, partyA })`. `chainId` and the `symmio`
 * address are resolved from the connected chain's config.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonUpnl();
 * const a = await mutateAsync({ partyB: "0xb…", partyA: "0xva…" });
 * ```
 */
export function useMuonUpnl(parameters: UseMuonUpnlParameters = {}): UseMuonUpnlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonUpnlReturnType, SymmioRequestError, GetMuonUpnlParameters>({
    mutationKey: ["getMuonUpnl"],
    mutationFn: async (variables) => {
      try {
        return await getMuonUpnl(config, {
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
