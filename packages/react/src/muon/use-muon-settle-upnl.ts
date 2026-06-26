"use client";

import {
  getMuonSettleUpnl,
  type ConfigParameter,
  type GetMuonSettleUpnlParameters,
  type GetMuonSettleUpnlReturnType,
} from "@theoldvarorg/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonSettleUpnl}: an optional `config` override. The
 * partyA and quote ids are passed as the mutation `variables`.
 */
export type UseMuonSettleUpnlParameters = ConfigParameter;

/** Return type of {@link useMuonSettleUpnl}. */
export type UseMuonSettleUpnlReturnType = UseMutationResult<
  GetMuonSettleUpnlReturnType,
  SymmioRequestError,
  GetMuonSettleUpnlParameters
>;

/**
 * Fetch a fresh Muon `settle_upnl` attestation for a partyA over a set of quote
 * ids, on demand, normalized to typed fields (settlement uPnL, quote ids,
 * signature envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are timestamped
 * and short-lived, so they are fetched on an explicit action, not eagerly on
 * mount. Call `mutateAsync({ partyA, quoteIds })`. `chainId` and the `symmio`
 * address are resolved from the connected chain's config. The settlement data
 * this produces is what `settleUpnl` requires.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonSettleUpnl();
 * const s = await mutateAsync({ partyA: "0xva…", quoteIds: [10n, 11n] });
 * ```
 */
export function useMuonSettleUpnl(parameters: UseMuonSettleUpnlParameters = {}): UseMuonSettleUpnlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonSettleUpnlReturnType, SymmioRequestError, GetMuonSettleUpnlParameters>({
    mutationKey: ["getMuonSettleUpnl"],
    mutationFn: async (variables) => {
      try {
        return await getMuonSettleUpnl(config, {
          partyA: variables.partyA,
          quoteIds: variables.quoteIds,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
