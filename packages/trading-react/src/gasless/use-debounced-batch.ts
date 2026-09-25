"use client";

import { getGaslessBatchFeeQuoteQueryKey, type GaslessBatchCall } from "@symmio/trading-core";
import { hashKey } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";

/** The part of a batch fee quote that a form changes as the user types. */
export interface DebouncedBatch {
  account: Address;
  calls: readonly GaslessBatchCall[];
}

/**
 * The batch to quote: `account` and `calls` once their **content** has held
 * still for `delayMs`, the last settled batch until then.
 *
 * Content, not identity. A form rebuilds its calls array on every render, so a
 * debounce keyed on the value itself would restart with every render — and
 * behind a component that re-renders faster than the delay, it would never
 * settle at all. The batch is keyed by its query key instead: the encoded
 * calldata, so a rebuilt but identical array changes nothing. The first batch
 * settles at once; `delayMs <= 0` passes every change straight through.
 *
 * @internal
 */
export function useDebouncedBatch(batch: DebouncedBatch, delayMs: number): DebouncedBatch {
  const key = hashKey(getGaslessBatchFeeQuoteQueryKey(batch));
  const [settled, setSettled] = useState({ key, batch });

  /** The newest batch, read when the timer fires — held in a ref so its identity can never restart the wait. */
  const latest = useRef(batch);
  useEffect(() => {
    latest.current = batch;
  });

  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => {
      setSettled((current) => (current.key === key ? current : { key, batch: latest.current }));
    }, delayMs);
    return () => clearTimeout(timer);
  }, [key, delayMs]);

  if (delayMs <= 0 || settled.key === key) return batch;
  return settled.batch;
}
