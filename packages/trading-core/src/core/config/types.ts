import type { Account, Chain, Transport, WalletClient } from "viem";

/**
 * A bound viem `WalletClient` with a hoisted account and chain — what write
 * actions need. The consuming layer supplies one (or several) through
 * {@link GetWalletClientsFn}.
 */
export type SymmioWalletClient = WalletClient<Transport, Chain, Account>;
