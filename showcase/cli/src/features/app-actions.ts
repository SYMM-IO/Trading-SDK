import { useCallback } from "react";
import { useAppState } from "./app-state.js";
import { useGate } from "./gate.js";

/**
 * Returns a handler that advances the gate one step by opening the right
 * overlay for the current blocking action (connect wallet, pick sub-account,
 * deposit, enable trading). Used by every "next step" CTA.
 */
export function useRunGate(): () => void {
  const { openOverlay } = useAppState();
  const gate = useGate();
  return useCallback(() => {
    switch (gate.action) {
      case "connect":
        openOverlay({ kind: "wallet" });
        break;
      case "select-subaccount":
      case "select-compatible-subaccount":
        openOverlay({ kind: "subaccount" });
        break;
      case "deposit":
        openOverlay({ kind: "deposit" });
        break;
      case "enable-trading":
        openOverlay({ kind: "enable-trading" });
        break;
      default:
        break;
    }
  }, [gate.action, openOverlay]);
}
