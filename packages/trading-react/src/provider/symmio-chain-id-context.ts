"use client";

import { createContext } from "react";

/**
 * React context holding the chain id pinned by {@link SymmioProvider}'s
 * `chainId` prop, or `undefined` when the provider follows the connected
 * wallet. Read by {@link useSymmioChainId}.
 *
 * @internal
 */
export const SymmioChainIdContext = createContext<number | undefined>(undefined);
