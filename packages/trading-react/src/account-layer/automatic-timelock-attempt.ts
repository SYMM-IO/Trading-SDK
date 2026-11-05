import { SymmError } from "@symmio/trading-core";
import type { QueryClient } from "@tanstack/react-query";
import type { Address } from "viem";

const prefix = ["symmio", "automatic-timelock-attempt"] as const;

export type AutomaticAttempt = {
  token: object;
  status: "pending" | "reconciliation";
};

export function automaticAttemptKey(chainId: number, accountLayer: Address, root: Address) {
  return [...prefix, chainId, accountLayer.toLowerCase(), root.toLowerCase()] as const;
}

export function deploymentHasAutomaticAttempt(client: QueryClient, chainId: number, accountLayer: Address) {
  return client
    .getQueryCache()
    .findAll({ queryKey: [...prefix, chainId, accountLayer.toLowerCase()] })
    .some((query) => Boolean(query.state.data));
}

export function reserveAutomaticAttempt(
  client: QueryClient,
  key: ReturnType<typeof automaticAttemptKey>,
  token: object,
) {
  client.setQueryDefaults(prefix, { gcTime: Infinity });
  const existing = client.getQueryData<AutomaticAttempt>(key);
  if (existing && existing.token !== token) {
    throw new SymmError(
      "validation",
      "TIMELOCK_RECONCILIATION_REQUIRED",
      "A previous timelock operation is pending or requires reconciliation.",
    );
  }
  if (!existing) client.setQueryData<AutomaticAttempt>(key, { token, status: "pending" });
}

export function finishAutomaticAttempt(
  client: QueryClient,
  key: ReturnType<typeof automaticAttemptKey>,
  token: object,
  confirmed: boolean,
) {
  const existing = client.getQueryData<AutomaticAttempt>(key);
  if (!existing || existing.token !== token) return;
  if (confirmed) client.removeQueries({ queryKey: key, exact: true });
  else client.setQueryData<AutomaticAttempt>(key, { ...existing, status: "reconciliation" });
}
