import type { Address, Hash, Hex } from "viem";
import type { GaslessExecutionConfig, SymmioGaslessConfig } from "../../core/chains/types";
import type { GaslessWriteOptions } from "../../shared/types/properties";

/** One ordered call carried by an InstantLayer write. @internal */
export interface GaslessDispatchCall {
  target: Address;
  callData: Hex;
}

/** The action's billing-account source; an explicit gasless.account always wins. @internal */
export type GaslessBillingAccount =
  | { kind: "explicit" }
  | { kind: "subaccount"; account: Address }
  | { kind: "virtual-account"; account: Address }
  | { kind: "account-or-virtual-account"; account: Address };

/** Relay settings and identity resolved once before selecting a signer. @internal */
export interface ResolvedGaslessWrite {
  chainId: number;
  gasless: SymmioGaslessConfig;
  options: GaslessWriteOptions;
  execution: GaslessExecutionConfig;
  fallback: "error" | "wallet";
  account: Address;
  operationType: string;
  calls: readonly GaslessDispatchCall[];
}

/** Only proven refusals are returned; ambiguous submissions and other failures throw. @internal */
export type GaslessWriteResult =
  | { kind: "broadcast"; hash: Hash }
  | { kind: "refused"; error: unknown; accepted: boolean };
