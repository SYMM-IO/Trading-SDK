"use client";

import {
  getMuonUpnlAWithSymbolPrice,
  type ConfigParameter,
  type GetMuonUpnlAWithSymbolPriceParameters,
  type GetMuonUpnlAWithSymbolPriceReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonUpnlAWithSymbolPrice}: an optional `config` override.
 * The partyA and symbolId are passed as the mutation `variables`.
 */
export type UseMuonUpnlAWithSymbolPriceParameters = ConfigParameter;

/** Return type of {@link useMuonUpnlAWithSymbolPrice}. */
export type UseMuonUpnlAWithSymbolPriceReturnType = UseMutationResult<
  GetMuonUpnlAWithSymbolPriceReturnType,
  SymmioRequestError,
  GetMuonUpnlAWithSymbolPriceParameters
>;

/**
 * Fetch a fresh Muon `uPnl_A_withSymbolPrice` attestation for a partyA and a single
 * symbol, on demand, normalized to typed fields (uPnl, price, notional, quote/symbol
 * ids, signature envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are timestamped
 * and short-lived, so they are fetched on an explicit action, not eagerly on
 * mount. Call `mutateAsync({ partyA, symbolId })`. `chainId` and the `symmio`
 * address are resolved from the connected chain's config. This attestation feeds
 * the `sendQuoteWithAffiliate` flow.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonUpnlAWithSymbolPrice();
 * const a = await mutateAsync({ partyA: "0xva…", symbolId: 1n });
 * ```
 */
export function useMuonUpnlAWithSymbolPrice(
  parameters: UseMuonUpnlAWithSymbolPriceParameters = {},
): UseMuonUpnlAWithSymbolPriceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonUpnlAWithSymbolPriceReturnType, SymmioRequestError, GetMuonUpnlAWithSymbolPriceParameters>({
    mutationKey: ["getMuonUpnlAWithSymbolPrice"],
    mutationFn: async (variables) => {
      try {
        return await getMuonUpnlAWithSymbolPrice(config, {
          partyA: variables.partyA,
          symbolId: variables.symbolId,
          chainId: variables.chainId ?? chainId,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
