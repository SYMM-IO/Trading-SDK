"use client";

import type { SolverId } from "@symmio/trading-core";
import {
  useSolverInfo,
  useSymmioChainId,
  useSymmioConfig,
  useTimelockPolicy,
  useVirtualAccount,
} from "@symmio/trading-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { zeroAddress, type Address } from "viem";
import {
  mayHaveTimelockRecovery,
  rememberTimelockHistory,
  subscribeTimelockRecoveryChanged,
  timelockHistoryKey,
} from "./timelock-recovery";

/** App-only readiness and indexing acknowledgement; protocol validation stays in the SDK. */
export function useTimelockContext(account?: Address, solverId?: SolverId, owner?: Address) {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const solver = config.getSolver({ chainId, solverId });
  const chainUnsupported = config.getChainConfig(chainId).timelockSupported === false;
  const supportsInfo = solver.id === "enigma" && solver.capabilities?.timelockApproval === true && !chainUnsupported;
  const accountLayer = config.getChainConfig(chainId).addresses.accountLayerAddress;
  useEffect(() => {
    if (!supportsInfo || !owner) return;
    try {
      rememberTimelockHistory(timelockHistoryKey(chainId, accountLayer, owner));
    } catch {
      // A protected write will report storage failure before it requests approval.
    }
  }, [supportsInfo, chainId, accountLayer, owner]);
  const getRecoverySnapshot = useCallback(
    () => mayHaveTimelockRecovery(chainId, accountLayer, owner),
    [chainId, accountLayer, owner],
  );
  const possibleRecovery = useSyncExternalStore(subscribeTimelockRecoveryChanged, getRecoverySnapshot, () => false);
  const checkRecovery = supportsInfo || possibleRecovery;
  const virtualAccount = useVirtualAccount({
    account,
    chainId,
    query: { enabled: Boolean(account && checkRecovery), retry: false },
  });
  const info = useSolverInfo({ chainId, solverId, query: { enabled: supportsInfo, staleTime: 0, retry: false } });
  const capability = info.data?.timelockApproval;
  const policy = useTimelockPolicy({
    account: account ?? zeroAddress,
    chainId,
    solverId,
    query: { enabled: Boolean(supportsInfo && account && capability), staleTime: 0, retry: false },
  });
  const scope = `${config.getChainConfigKey(chainId)}:${solver.url}:${account?.toLowerCase()}`;
  const rootAccount =
    policy.data?.rootAccount ??
    (virtualAccount.isSuccess
      ? virtualAccount.data?.isExists
        ? virtualAccount.data.parentAccount
        : account
      : undefined);
  const journalScope = rootAccount
    ? `v2:${chainId}:${config.getChainConfig(chainId).addresses.accountLayerAddress.toLowerCase()}:${rootAccount.toLowerCase()}`
    : undefined;
  // An acknowledgement never carries to a different deployment, account or policy.
  const fingerprint = JSON.stringify([scope, capability, policy.data], (_, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  const [indexedPolicy, setIndexedPolicy] = useState<string>();
  const indexingAcknowledged = indexedPolicy === fingerprint;
  const unsupported = !supportsInfo || (info.isSuccess && !info.error && !capability);
  const ready =
    unsupported || Boolean(capability && policy.data?.ready && !policy.error && !info.error && indexingAcknowledged);

  return {
    config,
    chainId,
    account,
    rootAccount,
    solverId,
    scope,
    journalScope,
    rootError: virtualAccount.error,
    info,
    policy,
    capability,
    timelockEnabled: supportsInfo,
    checkRecovery,
    chainUnsupported,
    unsupported,
    ready,
    indexingAcknowledged,
    acknowledgeIndexing: (checked: boolean) => setIndexedPolicy(checked ? fingerprint : undefined),
  };
}

export type TimelockContext = ReturnType<typeof useTimelockContext>;
