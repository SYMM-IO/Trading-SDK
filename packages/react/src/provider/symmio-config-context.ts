"use client";

import type { Config } from "@symm-frontier/core";
import { createContext } from "react";

/**
 * React context holding the SYMMIO {@link Config}. Populated by
 * {@link SymmioProvider}, read by {@link useSymmioConfig}.
 *
 * @internal
 */
export const SymmioConfigContext = createContext<Config | undefined>(undefined);
