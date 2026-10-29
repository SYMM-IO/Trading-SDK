"use client";

import type { SolverId } from "@symmio/trading-core";
import {
  useSolverInfo,
  useSymmioChainId,
  useSymmioConfig,
  useTimelockPolicy,
  useVirtualAccount,
} from "@symmio/trading-react";
import { useState } from "react";
import { zeroAddress, type Address } from "viem";

/** App-only readiness and indexing acknowledgement; protocol validation stays in the SDK. */
export function useTimelockContext(account?: Address, solverId?: SolverId) {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const solver = config.getSolver({ chainId, solverId });
  const chainUnsupported = config.getChainConfig(chainId).timelockSupported === false;
  const supportsInfo = solver.id === "enigma" && !chainUnsupported;
  const virtualAccount = useVirtualAccount({
    account,
    chainId,
    query: { enabled: Boolean(account && !chainUnsupported), retry: false },
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
    solverId,
    scope,
    journalScope,
    rootError: virtualAccount.error,
    info,
    policy,
    capability,
    chainUnsupported,
    unsupported,
    ready,
    indexingAcknowledged,
    acknowledgeIndexing: (checked: boolean) => setIndexedPolicy(checked ? fingerprint : undefined),
  };
}

export type TimelockContext = ReturnType<typeof useTimelockContext>;
