"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { SymmioClientConfig } from "../config";

const SymmioConfigContext = createContext<SymmioClientConfig | null>(null);

/**
 * Props for the SYMMIO SDK React provider.
 */
export interface SymmioProviderProps {
  /** SDK configuration used to create the shared SYMMIO client. */
  config: SymmioClientConfig;
  /** React subtree that can access the SYMMIO client through SDK hooks. */
  children: ReactNode;
}

/**
 * Provides SYMMIO SDK configuration to React hooks.
 */
export function SymmioProvider({ config, children }: SymmioProviderProps) {
  return <SymmioConfigContext.Provider value={config}>{children}</SymmioConfigContext.Provider>;
}

/**
 * Returns the SYMMIO SDK configuration from React context.
 */
export function useSymmioConfig(): SymmioClientConfig {
  const config = useContext(SymmioConfigContext);

  if (!config) {
    throw new Error("useSymmioConfig must be used within SymmioProvider");
  }

  return config;
}
