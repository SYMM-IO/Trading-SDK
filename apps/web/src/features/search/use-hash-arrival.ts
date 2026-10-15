"use client";

import { useEffect } from "react";
import { arriveAtCard } from "./arrive-at-card";

/**
 * Land on the card a shared link points at. A page opened at `#<card-id>` gets
 * the browser's own jump before its data loads, so the card drifts away as the
 * cards above it fill in, and nothing marks which card the link meant. This
 * gives that landing the treatment a search hit gets: held in place, focused,
 * and marked. Run once per page load — a hash that names no card is left to the
 * browser.
 */
export function useHashArrival() {
  useEffect(() => {
    let id: string;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!id) return;
    return arriveAtCard(id, { motion: "instant", pathname: window.location.pathname });
  }, []);
}
