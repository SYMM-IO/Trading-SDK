"use client";

import type { SymmioClient } from "@symm-frontier/core";
import { createContext, useContext } from "react";

/** Sentinel value to detect missing provider vs null client. */
const NO_PROVIDER = Symbol("NO_PROVIDER");

/**
 * React context for the SYMMIO client instance.
 * Created once in SymmioProvider, consumed by domain hooks.
 *
 * @internal
 */
export const SymmioClientContext = createContext<SymmioClient | undefined | typeof NO_PROVIDER>(NO_PROVIDER);

/**
 * Access the SYMMIO client from context.
 *
 * @throws Error if called outside of `SymmioProvider`.
 *
 * Returns `undefined` when the host's wagmi config has no transport bound for
 * the SDK's chain. When wallet is not connected, the client is still returned
 * but write operations will throw.
 *
 * @example
 * ```ts
 * const client = useSymmioClient();
 * if (!client) return <p>Chain not configured</p>;
 *
 * // Read operations work
 * const subs = await client.getUserSubAccounts({ user });
 *
 * // Write operations throw if wallet not connected
 * const hash = await client.editAccountName({ account, name });
 * ```
 */
export function useSymmioClient(): SymmioClient | undefined {
  const value = useContext(SymmioClientContext);
  if (value === NO_PROVIDER) {
    throw new Error("useSymmioClient must be used within a SymmioProvider");
  }
  return value;
}
