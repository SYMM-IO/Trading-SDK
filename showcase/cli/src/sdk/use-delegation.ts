import {
  ADD_MARGIN_TO_NEXT_VA_SELECTOR,
  finalizeRevokeDelegation,
  getActiveDelegations,
  getPendingRevocationEtas,
  getSessionKeySelectors,
  grantDelegation,
  initiateRevokeDelegation,
  type Config,
  type SubAccountIsolationType,
} from "@symmio/trading-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import { isCrossMarginIsolation } from "../lib/sub-account.js";
import { confirmTransaction } from "./confirm-transaction.js";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSigner } from "./use-signer.js";
import { useSubAccount } from "./use-sub-accounts.js";

/** The trade selectors this account model must grant to its local session key. */
function getRequiredTradingSelectors(
  config: Config,
  chainId: number,
  isolationType: SubAccountIsolationType | undefined,
): readonly Hex[] {
  const selectors = getSessionKeySelectors(config, { chainId, account: false });
  return isCrossMarginIsolation(isolationType)
    ? selectors.filter((selector) => selector.toLowerCase() !== ADD_MARGIN_TO_NEXT_VA_SELECTOR.toLowerCase())
    : selectors;
}

/**
 * Whether the session key holds every delegation required by the active
 * sub-account's isolation mode. VA-isolated accounts also need add-margin;
 * CUSTOM accounts do not. This cached state is for display; mutation hooks use
 * a fresh on-chain read through `useRequireActiveTradingDelegation`.
 */
export function useTradingDelegation() {
  const { config, chainId } = useSdkScope();
  const { subAccount, subAccountDetail } = useSubAccount();
  const { sessionKeyAddress } = useSigner();
  const enabled = Boolean(subAccount && sessionKeyAddress);

  const query = useQuery({
    queryKey: ["delegation", chainId, subAccount, sessionKeyAddress, subAccountDetail?.isolationType],
    enabled,
    refetchInterval: 20_000,
    queryFn: async () => {
      const account = subAccount as Address;
      const delegate = sessionKeyAddress as Address;
      const allTradeSelectors = getSessionKeySelectors(config, { chainId, account: false });
      const required = getRequiredTradingSelectors(config, chainId, subAccountDetail?.isolationType);
      const [active, pendingEtas] = await Promise.all([
        getActiveDelegations(config, {
          chainId,
          delegator: { addr: account, isPartyB: false },
          delegates: [delegate],
          selectors: [required],
        }),
        getPendingRevocationEtas(config, {
          chainId,
          delegator: { addr: account, isPartyB: false },
          delegate,
          selectors: allTradeSelectors,
        }),
      ]);
      const activeSelectors = new Set((active[0]?.selectors ?? []).map((selector) => selector.toLowerCase()));
      const revocationEtas = [...pendingEtas.values()];
      const revocationEta =
        revocationEtas.length > 0 ? revocationEtas.reduce((latest, eta) => (eta > latest ? eta : latest)) : undefined;
      const now = BigInt(Math.floor(Date.now() / 1000));
      return {
        activeCount: required.filter((selector) => activeSelectors.has(selector.toLowerCase())).length,
        requiredCount: required.length,
        allActive: required.length > 0 && required.every((selector) => activeSelectors.has(selector.toLowerCase())),
        revocationEta,
        isRevoking: revocationEta != null && revocationEta > now,
        needsFinalize: revocationEta != null && revocationEta <= now,
      };
    },
  });

  return {
    activeCount: query.data?.activeCount ?? 0,
    requiredCount: query.data?.requiredCount ?? 0,
    isActive: query.data?.allActive ?? false,
    isChecking: enabled && query.isLoading,
    revocationEta: query.data?.revocationEta,
    isRevoking: query.data?.isRevoking ?? false,
    needsFinalize: query.data?.needsFinalize ?? false,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

/**
 * Build the mutation-time guard for every write signed by the local session
 * key. It checks the key's local expiry and then performs a fresh canonical
 * `getActiveDelegations` read; cached UI readiness never authorizes a write.
 */
export function useRequireActiveTradingDelegation(): () => Promise<Address> {
  const { config, chainId } = useSdkScope();
  const { subAccount, subAccountDetail } = useSubAccount();
  const { sessionKeyAddress, sessionKeyExpiresAt } = useSigner();

  return async function requireActiveTradingDelegation(): Promise<Address> {
    if (!subAccount) throw new Error("Select a sub-account first.");
    if (subAccountDetail == null) {
      throw new Error("The selected sub-account is not loaded, so its trading delegation cannot be verified.");
    }
    if (!sessionKeyAddress) throw new Error("Enable trading (session key) first.");
    if (sessionKeyExpiresAt == null || sessionKeyExpiresAt <= Date.now()) {
      throw new Error("The local session key expired. Reconnect the wallet to rotate it before trading.");
    }

    const required = getRequiredTradingSelectors(config, chainId, subAccountDetail.isolationType);
    if (required.length === 0) {
      throw new Error("No trading delegation selectors are configured for the active deployment.");
    }

    let active: Awaited<ReturnType<typeof getActiveDelegations>>;
    try {
      active = await getActiveDelegations(config, {
        chainId,
        delegator: { addr: subAccount, isPartyB: false },
        delegates: [sessionKeyAddress],
        selectors: [required],
      });
    } catch (cause) {
      throw new Error("Unable to verify the on-chain trading delegation. No delegated write was signed.", { cause });
    }

    const wantedDelegate = sessionKeyAddress.toLowerCase();
    const activeSelectors = new Set<string>();
    let earliestExpiry: bigint | undefined;
    for (const entry of active) {
      if (entry.delegatedSigner.toLowerCase() !== wantedDelegate) continue;
      for (const selector of entry.selectors) activeSelectors.add(selector.toLowerCase());
      earliestExpiry =
        earliestExpiry === undefined || entry.expiryTimestamp < earliestExpiry ? entry.expiryTimestamp : earliestExpiry;
    }

    const missing = required.filter((selector) => !activeSelectors.has(selector.toLowerCase()));
    if (missing.length > 0) {
      throw new Error(
        `The on-chain trading delegation is not active (${missing.length}/${required.length} selectors missing). Re-enable one-tap trading before retrying.`,
      );
    }

    const nowSeconds = BigInt(Math.ceil(Date.now() / 1_000));
    if (earliestExpiry == null || earliestExpiry <= nowSeconds) {
      throw new Error("The on-chain trading delegation has expired. Re-enable one-tap trading before retrying.");
    }

    return sessionKeyAddress;
  };
}

/** Grant only the active isolation mode's required trade selectors (one owner transaction). */
export function useGrantTradingDelegation() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  const { subAccount, subAccountDetail } = useSubAccount();
  const { sessionKeyAddress, sessionKeyExpiresAt } = useSigner();

  return useMutation({
    mutationFn: async () => {
      if (!subAccount) throw new Error("Select a sub-account first.");
      if (!sessionKeyAddress) throw new Error("Initialize a session key first (connect a signing wallet).");
      if (!sessionKeyExpiresAt || sessionKeyExpiresAt <= Date.now()) {
        throw new Error("The local session key has expired. Reconnect the wallet to rotate it before delegating.");
      }
      const selectors = getRequiredTradingSelectors(config, chainId, subAccountDetail?.isolationType);
      return confirmTransaction(
        config,
        chainId,
        grantDelegation(config, {
          chainId,
          account: { addr: subAccount as Address, isPartyB: false },
          delegatedSigner: sessionKeyAddress,
          selectors,
          expiryTimestamp: BigInt(Math.floor(sessionKeyExpiresAt / 1000)),
        }),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delegation"] });
    },
  });
}

function useRevokeTradingDelegation(finalize: boolean) {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  const { subAccount } = useSubAccount();
  const { address, sessionKeyAddress } = useSigner();

  return useMutation({
    mutationFn: async () => {
      if (!subAccount || !sessionKeyAddress) throw new Error("Select a sub-account with an initialized session key.");
      const parameters = {
        chainId,
        account: { addr: subAccount as Address, isPartyB: false },
        delegate: sessionKeyAddress,
        selectors: [...getSessionKeySelectors(config, { chainId, account: false })] as Hex[],
        from: address,
      };
      const hash = finalize
        ? finalizeRevokeDelegation(config, parameters)
        : initiateRevokeDelegation(config, parameters);
      return confirmTransaction(config, chainId, hash);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["delegation"] }),
  });
}

/** Start the cooldown-backed revocation of every terminal trading selector. */
export function useInitiateTradingRevocation() {
  return useRevokeTradingDelegation(false);
}

/** Clean up an elapsed delegation revocation schedule on-chain. */
export function useFinalizeTradingRevocation() {
  return useRevokeTradingDelegation(true);
}
