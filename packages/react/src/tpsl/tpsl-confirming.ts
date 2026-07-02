import type { QueryClient } from "@tanstack/react-query";

/** Per-side flags marking "POST accepted, waiting for WS confirmation". */
export interface TpSlConfirming {
  tp: boolean;
  sl: boolean;
}

/** Empty snapshot — nothing awaiting confirmation. */
export const EMPTY_TPSL_CONFIRMING: TpSlConfirming = { tp: false, sl: false };

/**
 * Query key for the shared "confirming" slot used to bridge
 * {@link useSetQuoteTpSl} and {@link useQuoteTpSl}.
 *
 * The set-mutation writes `{tp,sl}` here on POST 200; the read-hook overlays
 * `confirming` onto the folded snapshot until a matching WS report clears the
 * flag.
 */
export function getTpSlConfirmingQueryKey(parameters: {
  chainId: number;
  quoteId: bigint;
  configKey: string;
}): readonly [string, { chainId: number; quoteId: string; configKey: string }] {
  return [
    "tpsl-confirming",
    { chainId: parameters.chainId, quoteId: parameters.quoteId.toString(), configKey: parameters.configKey },
  ] as const;
}

/**
 * Mark one or both sides as awaiting WS confirmation. Merges with any existing
 * flags so an in-flight SL doesn't clear a TP that's still waiting.
 */
export function markTpSlConfirming(
  queryClient: QueryClient,
  key: ReturnType<typeof getTpSlConfirmingQueryKey>,
  sides: Partial<TpSlConfirming>,
): void {
  queryClient.setQueryData<TpSlConfirming>(key, (prev) => ({
    tp: sides.tp ?? prev?.tp ?? false,
    sl: sides.sl ?? prev?.sl ?? false,
  }));
}

/**
 * Clear one side's confirming flag (called on a matching successful WS
 * frame). Leaves the other side untouched.
 */
export function clearTpSlConfirmingSide(
  queryClient: QueryClient,
  key: ReturnType<typeof getTpSlConfirmingQueryKey>,
  side: "tp" | "sl",
): void {
  queryClient.setQueryData<TpSlConfirming>(key, (prev) => {
    if (!prev || !prev[side]) return prev ?? EMPTY_TPSL_CONFIRMING;
    return { ...prev, [side]: false };
  });
}
