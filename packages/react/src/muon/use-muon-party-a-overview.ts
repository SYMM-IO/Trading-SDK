"use client";

import {
  getMuonPartyAOverview,
  type ConfigParameter,
  type GetMuonPartyAOverviewParameters,
  type GetMuonPartyAOverviewReturnType,
} from "@symm-frontier/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonPartyAOverview}: an optional `config` override. The
 * partyA is passed as the mutation `variables`.
 */
export type UseMuonPartyAOverviewParameters = ConfigParameter;

/** Return type of {@link useMuonPartyAOverview}. */
export type UseMuonPartyAOverviewReturnType = UseMutationResult<
  GetMuonPartyAOverviewReturnType,
  SymmioRequestError,
  GetMuonPartyAOverviewParameters
>;

/**
 * Fetch a fresh Muon `partyA_overview` attestation for a partyA, on demand,
 * normalized to typed fields (uPnl, loss, liquidation id, quote/symbol ids,
 * signature envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are timestamped
 * and short-lived, so they are fetched on an explicit action, not eagerly on
 * mount. Call `mutateAsync({ partyA })`. `chainId` and the `symmio` address are
 * resolved from the connected chain's config. This is the uPnL + liquidation data
 * behind `liquidatePartyA` / `setSymbolsPrice` (it produces a `LiquidationSig`).
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonPartyAOverview();
 * const overview = await mutateAsync({ partyA: "0xva…" });
 * ```
 */
export function useMuonPartyAOverview(
  parameters: UseMuonPartyAOverviewParameters = {},
): UseMuonPartyAOverviewReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonPartyAOverviewReturnType, SymmioRequestError, GetMuonPartyAOverviewParameters>({
    mutationKey: ["getMuonPartyAOverview"],
    mutationFn: async (variables) => {
      try {
        return await getMuonPartyAOverview(config, {
          partyA: variables.partyA,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
