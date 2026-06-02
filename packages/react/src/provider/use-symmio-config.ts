"use client";

import type { Config } from "@symm-frontier/core";
import { useContext } from "react";
import { SymmioConfigContext } from "./symmio-config-context";

/**
 * Parameters for {@link useSymmioConfig}.
 */
export interface UseSymmioConfigParameters {
  /** Use this config instead of the one from {@link SymmioProvider}'s context. */
  config?: Config;
}

/**
 * Access the SYMMIO {@link Config}. Returns the explicit `parameters.config`
 * when given, otherwise the one provided by {@link SymmioProvider}. Mirrors
 * wagmi's `useConfig`.
 *
 * @throws Error when no config is available (called outside a `SymmioProvider`
 *   and no `config` override was passed).
 *
 * @example
 * ```ts
 * const config = useSymmioConfig();
 * const markets = await getMarkets(config, {});
 * ```
 */
export function useSymmioConfig(parameters: UseSymmioConfigParameters = {}): Config {
  const context = useContext(SymmioConfigContext);
  const config = parameters.config ?? context;
  if (!config) {
    throw new Error("useSymmioConfig must be used within a SymmioProvider, or be passed an explicit `config`.");
  }
  return config;
}
