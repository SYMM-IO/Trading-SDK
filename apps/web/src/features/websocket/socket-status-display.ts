import type { SocketStatus } from "@symm-frontier/core";

/** Map a {@link SocketStatus} to a `StatusDot` tone. */
export function socketStatusTone(status: SocketStatus): "positive" | "warning" | "neutral" {
  if (status === "open") return "positive";
  if (status === "connecting" || status === "reconnecting") return "warning";
  return "neutral";
}

/** Human-readable label for a {@link SocketStatus}. */
export function socketStatusLabel(status: SocketStatus): string {
  switch (status) {
    case "open":
      return "Connected";
    case "connecting":
      return "Connecting…";
    case "reconnecting":
      return "Reconnecting…";
    case "closing":
      return "Closing…";
    default:
      return "Disconnected";
  }
}
