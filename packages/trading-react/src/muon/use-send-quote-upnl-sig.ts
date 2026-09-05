"use client";

import {
  getSendQuoteUpnlSig,
  type ConfigParameter,
  type GetSendQuoteUpnlSigParameters,
  type GetSendQuoteUpnlSigReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSendQuoteUpnlSig}: an optional `config` override. The
 * partyA and symbol id are passed as the mutation `variables`.
 */
export type UseSendQuoteUpnlSigParameters = ConfigParameter;

/** Return type of {@link useSendQuoteUpnlSig}. */
export type UseSendQuoteUpnlSigReturnType = UseMutationResult<
  GetSendQuoteUpnlSigReturnType,
  SymmioRequestError,
  GetSendQuoteUpnlSigParameters
>;

/**
 * Fetch a fresh Muon `uPnl_A_withSymbolPrice` attestation, on demand, assembled
 * into the contract-ready `SingleUpnlAndPriceSig` that `sendQuote` takes.
 *
 * Modeled as a **mutation** rather than a query: the signature is timestamped,
 * short-lived, and signed *inside* the quote calldata, so it must be fetched at
 * submit time and never cached across a session. Solvers that enforce Muon
 * verification (Rasa / majors) require it; the lowcap InstantLayer flow signs a
 * placeholder instead, and `useInstantOpen` already fetches this internally for
 * the solvers that need it — reach for this hook only when you drive the quote
 * calldata yourself.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useSendQuoteUpnlSig();
 * const upnlSig = await mutateAsync({ partyA: subAccount, symbolId: 1n });
 * ```
 */
export function useSendQuoteUpnlSig(parameters: UseSendQuoteUpnlSigParameters = {}): UseSendQuoteUpnlSigReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  return useMutation<GetSendQuoteUpnlSigReturnType, SymmioRequestError, GetSendQuoteUpnlSigParameters>({
    mutationKey: ["getSendQuoteUpnlSig"],
    mutationFn: async (variables) => {
      try {
        return await getSendQuoteUpnlSig(config, {
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
