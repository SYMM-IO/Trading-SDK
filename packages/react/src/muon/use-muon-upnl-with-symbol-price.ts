"use client";

import {
  getMuonUpnlWithSymbolPrice,
  type ConfigParameter,
  type GetMuonUpnlWithSymbolPriceParameters,
  type GetMuonUpnlWithSymbolPriceReturnType,
} from "@theoldvarorg/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMuonUpnlWithSymbolPrice}: an optional `config` override.
 * The partyB, partyA, and symbolId are passed as the mutation `variables`.
 */
export type UseMuonUpnlWithSymbolPriceParameters = ConfigParameter;

/** Return type of {@link useMuonUpnlWithSymbolPrice}. */
export type UseMuonUpnlWithSymbolPriceReturnType = UseMutationResult<
  GetMuonUpnlWithSymbolPriceReturnType,
  SymmioRequestError,
  GetMuonUpnlWithSymbolPriceParameters
>;

/**
 * Fetch a fresh Muon `uPnlWithSymbolPrice` attestation for a partyB/partyA pair
 * and a symbol id, on demand, normalized to typed fields (price, both parties'
 * uPnL, quote ids, signature envelope).
 *
 * Modeled as a **mutation** rather than a query: Muon attestations are timestamped
 * and short-lived, so they are fetched on an explicit action, not eagerly on
 * mount. Call `mutateAsync({ partyB, partyA, symbolId })`. `chainId` and the
 * `symmio` address are resolved from the connected chain's config.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useMuonUpnlWithSymbolPrice();
 * const a = await mutateAsync({ partyB: "0xsolver…", partyA: "0xva…", symbolId: 1n });
 * ```
 */
export function useMuonUpnlWithSymbolPrice(
  parameters: UseMuonUpnlWithSymbolPriceParameters = {},
): UseMuonUpnlWithSymbolPriceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetMuonUpnlWithSymbolPriceReturnType, SymmioRequestError, GetMuonUpnlWithSymbolPriceParameters>({
    mutationKey: ["getMuonUpnlWithSymbolPrice"],
    mutationFn: async (variables) => {
      try {
        return await getMuonUpnlWithSymbolPrice(config, {
          partyB: variables.partyB,
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
