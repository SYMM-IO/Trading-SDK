"use client";

import type { ListingDepositChainId } from "@symmio/trading-core";
import { useListingConfig } from "@symmio/trading-react";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { useEffect, useMemo } from "react";

interface Props {
  /** Namespaces the picker's `id` and every `data-testid` (`{idPrefix}-trigger`, `-search`, …). */
  idPrefix: string;
  /** Selected deposit chain. */
  value: ListingDepositChainId;
  /** Fired with the picked chain id. */
  onValueChange: (chainId: ListingDepositChainId) => void;
  /** Disable the picker while the owning form is busy. */
  disabled?: boolean;
}

/**
 * Deposit-chain picker over the listing config's supported chains.
 *
 * The chain list is read from `useListingConfig`, not hardcoded — the picker only
 * offers chains the listing service actually accepts. Once that list lands it
 * keeps the selection valid: if the current chain is not among the supported ones
 * it falls back to the first, reporting the correction through `onValueChange`.
 *
 * The field is required, so the picker is rendered without its clear control.
 */
export function DepositChainSelect({ idPrefix, value, onValueChange, disabled }: Props) {
  const config = useListingConfig();
  const chains = useMemo(() => config.data?.supportedDepositChains ?? [], [config.data]);

  useEffect(() => {
    if (chains.length > 0 && !chains.some((chain) => chain.chainId === value)) {
      onValueChange(chains[0]!.chainId);
    }
  }, [chains, value, onValueChange]);

  const items = useMemo<MarketSelectItem[]>(
    () =>
      chains.map((chain) => ({
        id: String(chain.chainId),
        label: `${chain.chainName} (${chain.chainId})`,
        searchText: `${chain.chainName} ${chain.chainId}`,
      })),
    [chains],
  );

  return (
    <MarketSelect
      idPrefix={idPrefix}
      value={String(value)}
      items={items}
      onValueChange={(next) => onValueChange(Number(next) as ListingDepositChainId)}
      disabled={disabled || config.isPending}
      clearable={false}
      placeholder={config.isPending ? "Loading chains..." : "Select a deposit chain..."}
      searchPlaceholder="Search chains..."
      emptyLabel="No deposit chains."
      emptyResultsLabel="No chains match this search."
    />
  );
}
