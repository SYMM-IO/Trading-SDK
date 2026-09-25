import {
  GaslessRequestStatus,
  approveOperationalFee,
  getGaslessDepositPolicyQueryOptions,
  getGaslessRequestQueryKey,
  getGaslessRequestQueryOptions,
  getGaslessRequestTransactionsQueryKey,
  getGaslessRequestTransactionsQueryOptions,
  getGaslessUnconfirmedSubmit,
  getGaslessWalletAddressQueryOptions,
  getGaslessWalletNonceQueryOptions,
  getOperationalFeeAllowanceQueryOptions,
  isGaslessRequestTerminal,
  resolveGaslessService,
  resubmitGaslessRequest,
  settleGaslessDepositExistingAccount,
  supportsGaslessService,
  supportsGaslessStatusStream,
  watchGaslessRequest,
  type GaslessDepositSubmitReceipt,
  type GaslessRequest,
  type GaslessService,
  type GaslessStatusTransport,
  type GaslessStreamStatus,
  type GaslessStreamStatusDetail,
  type SymmioGaslessConfig,
} from "@symmio/trading-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { erc20Abi, zeroAddress, type Address } from "viem";
import { confirmTransaction } from "./confirm-transaction.js";
import { updateGaslessJournalStatus } from "./gasless-request-journal.js";
import { useSdkScope } from "./use-sdk-scope.js";

/** Resolved chain-level GaslessQ availability for the active deployment. */
export interface GaslessCapability {
  supported: boolean;
  contractsVersion: string;
  service?: SymmioGaslessConfig;
  operationsStream: boolean;
  depositsStream: boolean;
}

/** Resolve the active deployment's gasless gate without throwing on unsupported chains. */
export function useGaslessCapability(): GaslessCapability {
  const { config, chainId } = useSdkScope();
  const chain = config.getChainConfig(chainId);
  const supported = supportsGaslessService(config, { chainId });
  return {
    supported,
    contractsVersion: chain.contractsVersion,
    service: supported ? resolveGaslessService(config, { chainId }) : undefined,
    operationsStream: supported && supportsGaslessStatusStream(config, { chainId, service: "operations" }),
    depositsStream: supported && supportsGaslessStatusStream(config, { chainId, service: "deposits" }),
  };
}

/** Read the deterministic wallet, nonce, policy, parked balance, and fee allowance. */
export function useGaslessAccountData(parameters: {
  enabled: boolean;
  owner?: Address;
  payer?: Address;
  walletId: bigint;
}) {
  const { config, chainId } = useSdkScope();
  const owner = parameters.owner ?? zeroAddress;
  const payer = parameters.payer ?? zeroAddress;
  const enabled = parameters.enabled && parameters.owner !== undefined;

  const wallet = useQuery(
    getGaslessWalletAddressQueryOptions(config, {
      chainId,
      owner,
      walletId: parameters.walletId,
      query: { enabled, staleTime: 30_000 },
    }),
  );
  const policy = useQuery(
    getGaslessDepositPolicyQueryOptions(config, {
      chainId,
      owner,
      walletId: parameters.walletId,
      query: { enabled, staleTime: 15_000 },
    }),
  );
  const nonce = useQuery(
    getGaslessWalletNonceQueryOptions(config, {
      chainId,
      owner,
      account: parameters.payer ?? owner,
      walletId: parameters.walletId,
      query: { enabled, staleTime: 5_000 },
    }),
  );
  const allowance = useQuery(
    getOperationalFeeAllowanceQueryOptions(config, {
      chainId,
      payer,
      query: { enabled: parameters.enabled && parameters.payer !== undefined, staleTime: 5_000 },
    }),
  );
  const depositBalance = useQuery({
    queryKey: ["gaslessDepositBalance", chainId, policy.data?.collateralTokenAddress, policy.data?.depositAddress],
    queryFn: () =>
      config.getClient({ chainId }).readContract({
        address: policy.data!.collateralTokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [policy.data!.depositAddress],
      }),
    enabled: parameters.enabled && policy.data !== undefined,
    refetchInterval: 5_000,
  });

  function refetch(): void {
    void Promise.all([
      wallet.refetch(),
      policy.refetch(),
      nonce.refetch(),
      allowance.refetch(),
      depositBalance.refetch(),
    ]);
  }

  return { wallet, policy, nonce, allowance, depositBalance, refetch };
}

/** Wallet-paid grant of a bounded Core allowance to the configured GaslessLayer charger. */
export function useApproveGaslessAllowance() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { account: Address; amount: bigint }) =>
      confirmTransaction(
        config,
        chainId,
        approveOperationalFee(config, {
          chainId,
          account: variables.account,
          amounts: [variables.amount],
          gasless: false,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["getOperationalFeeAllowance"] });
    },
  });
}

/** Queue a funded deterministic wallet's complete balance into an existing selected sub-account. */
export function useSettleGaslessDeposit(parameters: { onAccepted: (receipt: GaslessDepositSubmitReceipt) => void }) {
  const { config, chainId } = useSdkScope();
  return useMutation({
    mutationFn: (variables: { owner: Address; walletId: bigint; subAccount: Address }) =>
      settleGaslessDepositExistingAccount(config, { chainId, ...variables }),
    onSuccess: parameters.onAccepted,
    onError: (error) => {
      const accepted = acceptedDepositFromError(error);
      if (accepted) parameters.onAccepted(accepted);
    },
  });
}

/** Replay an ambiguous deposit submit byte-for-byte under its original idempotency key. */
export function useReplayGaslessDeposit(parameters: { onAccepted: (receipt: GaslessDepositSubmitReceipt) => void }) {
  const { config } = useSdkScope();
  return useMutation({
    mutationFn: async (error: unknown) => {
      const replay = getGaslessUnconfirmedSubmit(error);
      if (!replay || replay.service !== "deposits") {
        throw new Error("No replayable gasless deposit submit is available in memory.");
      }
      const receipt = await resubmitGaslessRequest(config, replay);
      if (!("depositAddress" in receipt)) {
        throw new Error("The recovered request was not a deposit settlement.");
      }
      return receipt;
    },
    onSuccess: parameters.onAccepted,
    onError: (error) => {
      const accepted = acceptedDepositFromError(error);
      if (accepted) parameters.onAccepted(accepted);
    },
  });
}

/** Recover an already-accepted deposit receipt carried by the SDK's post-acceptance mismatch error. */
function acceptedDepositFromError(error: unknown): GaslessDepositSubmitReceipt | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { code?: unknown; responseData?: unknown };
  if (candidate.code !== "GASLESS_DEPOSIT_WALLET_MISMATCH") return null;
  const receipt = candidate.responseData as Partial<GaslessDepositSubmitReceipt> | undefined;
  if (!receipt || typeof receipt.requestId !== "string" || typeof receipt.depositAddress !== "string") return null;
  return receipt as GaslessDepositSubmitReceipt;
}

/** Return the exact replay payload only while an ambiguous submit remains in memory. */
export function getGaslessReplay(error: unknown) {
  return getGaslessUnconfirmedSubmit(error);
}

export interface GaslessStreamState {
  status: GaslessStreamStatus;
  detail: GaslessStreamStatusDetail | null;
  live: boolean;
}

/** Follow one request over the status stream with the SDK query factory as its polling fallback. */
export function useGaslessRequestLifecycle(parameters: {
  enabled: boolean;
  requestId: string;
  service: GaslessService;
  transport?: GaslessStatusTransport;
}) {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  const enabled = parameters.enabled && parameters.requestId.length > 0;
  const stream = useGaslessRequestStream({
    config,
    chainId,
    requestId: parameters.requestId,
    service: parameters.service,
    enabled,
    transport: parameters.transport,
  });
  const requestOptions = getGaslessRequestQueryOptions(config, {
    chainId,
    requestId: parameters.requestId,
    service: parameters.service,
    query: { enabled },
  });
  const request = useQuery({
    ...requestOptions,
    refetchInterval: stream.live ? false : requestOptions.refetchInterval,
  });
  const attempts = useQuery(
    getGaslessRequestTransactionsQueryOptions(config, {
      chainId,
      requestId: parameters.requestId,
      service: parameters.service,
      status: request.data?.status,
      query: { enabled: enabled && request.data !== undefined },
    }),
  );
  const invalidatedRequest = useRef<string | null>(null);

  useEffect(() => {
    if (!request.data) return;
    void updateGaslessJournalStatus({
      chainId,
      requestId: parameters.requestId,
      service: parameters.service,
      status: request.data.status,
    });
    if (request.data.status !== GaslessRequestStatus.SUCCEEDED) return;
    if (invalidatedRequest.current === parameters.requestId) return;
    invalidatedRequest.current = parameters.requestId;
    for (const key of [
      "balanceOf",
      "balanceInfo",
      "collateralBalance",
      "subAccounts",
      "getOperationalFeeAllowance",
      "getGaslessDepositPolicy",
      "getGaslessWalletNonce",
      "gaslessDepositBalance",
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [request.data, parameters.requestId, parameters.service, chainId, queryClient]);

  return { request, attempts, stream };
}

function useGaslessRequestStream(parameters: {
  config: ReturnType<typeof useSdkScope>["config"];
  chainId: number;
  requestId: string;
  service: GaslessService;
  enabled: boolean;
  transport?: GaslessStatusTransport;
}): GaslessStreamState {
  const { config, chainId, requestId, service, enabled, transport = "auto" } = parameters;
  const queryClient = useQueryClient();
  const [state, setState] = useState<GaslessStreamState>({ status: "idle", detail: null, live: false });
  const active = enabled && transport !== "poll" && supportsGaslessStatusStream(config, { chainId, service });

  useEffect(() => {
    if (!active) {
      setState({ status: "idle", detail: null, live: false });
      return;
    }

    const configKey = config.getChainConfigKey(chainId);
    const requestKey = getGaslessRequestQueryKey({ chainId, requestId, service, configKey });
    const attemptsKey = getGaslessRequestTransactionsQueryKey({ chainId, requestId, service, configKey });

    try {
      return watchGaslessRequest(config, {
        chainId,
        requestId,
        service,
        onUpdate: ({ request, transactions }) => {
          if (request) {
            void queryClient.cancelQueries({ queryKey: requestKey, exact: true });
            queryClient.setQueryData(requestKey, (previous: GaslessRequest | undefined) =>
              previous && isNewerGaslessRequest(previous, request) ? previous : request,
            );
          }
          if (transactions.length > 0) {
            void queryClient.cancelQueries({ queryKey: attemptsKey, exact: true });
            queryClient.setQueryData(attemptsKey, transactions);
          }
        },
        onStatusChange: (status, detail) => setState({ status, detail, live: status === "live" }),
        onError: () => {
          /* The HTTP query remains the authoritative fallback. */
        },
      });
    } catch {
      setState({ status: "idle", detail: null, live: false });
      return;
    }
  }, [active, config, chainId, requestId, service, queryClient]);

  return state;
}

function isNewerGaslessRequest(previous: GaslessRequest, next: GaslessRequest): boolean {
  if (isGaslessRequestTerminal(previous.status) && !isGaslessRequestTerminal(next.status)) return true;
  if (previous.updatedAt && next.updatedAt) return previous.updatedAt > next.updatedAt;
  return false;
}
