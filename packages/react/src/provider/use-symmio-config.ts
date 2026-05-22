"use client";

import { useContext } from "react";
import type { SymmioClientConfig } from "../config";
import { SymmioConfigContext } from "./symmio-provider";

/**
 * Read the resolved SYMMIO SDK configuration from React context. Throws when
 * called outside `SymmioProvider`.
 *
 * @example
 * const config = useSymmioConfig();
 * config.addresses.accountLayerAddress; // typed Address
 *
 * @throws when called outside `SymmioProvider`.
 */
export function useSymmioConfig(): SymmioClientConfig {
  const config = useContext(SymmioConfigContext);

  if (!config) {
    throw new Error("useSymmioConfig must be used within SymmioProvider");
  }

  return config;
}
