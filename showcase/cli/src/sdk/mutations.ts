import {
  addMargin,
  allocate,
  approveCollateral,
  createSubAccounts,
  deallocate,
  deleteSubAccount,
  depositAndAllocateForAccount,
  depositForAccount,
  editAccountName,
  finalizeWithdrawRequest,
  forceCancelCloseRequest,
  forceCancelQuote,
  forceCloseAuto,
  getDeallocateUpnlSig,
  instantCloseAuto,
  instantCloseBulkAuto,
  instantOpenAuto,
  limitCloseAuto,
  limitOpenAuto,
  removeMargin,
  requestCancelWithdraw,
  requestToCancelCloseRequest,
  requestToCancelQuote,
  setQuoteTpSl,
  withdrawAuto,
  type AddMarginParameters,
  type AllocateParameters,
  type ApproveCollateralParameters,
  type CreateSubAccountsParameters,
  type DeallocateParameters,
  type DeleteSubAccountParameters,
  type DepositAndAllocateForAccountParameters,
  type DepositForAccountParameters,
  type EditAccountNameParameters,
  type FinalizeWithdrawRequestParameters,
  type ForceCancelCloseRequestParameters,
  type ForceCancelQuoteParameters,
  type ForceCloseAutoParameters,
  type InstantCloseBulkAutoParameters,
  type PrepareInstantCloseParameters,
  type PrepareInstantOpenParameters,
  type PrepareLimitCloseParameters,
  type PrepareLimitOpenParameters,
  type RemoveMarginParameters,
  type RequestCancelWithdrawParameters,
  type RequestToCancelCloseRequestParameters,
  type RequestToCancelQuoteParameters,
  type SetQuoteTpSlParameters,
  type WithdrawAutoParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { confirmTransaction } from "./confirm-transaction.js";
import { useRequireActiveTradingDelegation } from "./use-delegation.js";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSigner } from "./use-signer.js";
import { useSubAccount } from "./use-sub-accounts.js";
import { TPSL_QUERY_KEY } from "./use-tpsl.js";

function invalidate(queryClient: QueryClient, chainId: number, keys: string[]): void {
  for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key, chainId] });
}

/** ERC-20 approve of collateral to the SYMMIO core (main wallet signs). */
export function useApproveCollateral() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: ApproveCollateralParameters) =>
      confirmTransaction(config, chainId, approveCollateral(config, { ...variables, chainId })),
    onSuccess: () => invalidate(queryClient, chainId, ["collateralAllowance"]),
  });
}

/** Deposit collateral into the sub-account's available balance. */
export function useDeposit() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: DepositForAccountParameters) =>
      confirmTransaction(config, chainId, depositForAccount(config, { ...variables, chainId })),
    onSuccess: () =>
      invalidate(queryClient, chainId, ["balanceOf", "balanceInfo", "collateralBalance", "collateralAllowance"]),
  });
}

/** Deposit collateral and allocate it to the classic margin pool. */
export function useDepositAndAllocate() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: DepositAndAllocateForAccountParameters) =>
      confirmTransaction(config, chainId, depositAndAllocateForAccount(config, { ...variables, chainId })),
    onSuccess: () =>
      invalidate(queryClient, chainId, ["balanceOf", "balanceInfo", "collateralBalance", "collateralAllowance"]),
  });
}

/** Move available collateral into allocated balance. */
export function useAllocate() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: AllocateParameters) =>
      confirmTransaction(config, chainId, allocate(config, { ...variables, chainId })),
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo"]),
  });
}

/** Move allocated collateral back to available balance with a fresh Muon attestation. */
export function useDeallocate() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: Omit<DeallocateParameters, "upnlSig">) => {
      const upnlSig = await getDeallocateUpnlSig(config, { chainId, virtualAccount: variables.account });
      return confirmTransaction(config, chainId, deallocate(config, { ...variables, chainId, upnlSig }));
    },
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo"]),
  });
}

/** Add margin to a position's Virtual Account. */
export function useAddMargin() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: AddMarginParameters) =>
      confirmTransaction(config, chainId, addMargin(config, { ...variables, chainId })),
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo", "managed-positions"]),
  });
}

/** Remove margin from a VA with a fresh Muon attestation. */
export function useRemoveMargin() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: Omit<RemoveMarginParameters, "upnlSig">) => {
      const upnlSig = await getDeallocateUpnlSig(config, { chainId, virtualAccount: variables.virtualAccount });
      return confirmTransaction(config, chainId, removeMargin(config, { ...variables, chainId, upnlSig }));
    },
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo", "managed-positions"]),
  });
}

/** Create one or more sub-accounts. */
export function useCreateSubAccount() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: CreateSubAccountsParameters) =>
      confirmTransaction(config, chainId, createSubAccounts(config, { ...variables, chainId })),
    onSuccess: () => invalidate(queryClient, chainId, ["subAccounts"]),
  });
}

/** Rename a sub-account. */
export function useEditAccountName() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: EditAccountNameParameters) =>
      confirmTransaction(config, chainId, editAccountName(config, { ...variables, chainId })),
    onSuccess: () => invalidate(queryClient, chainId, ["subAccounts"]),
  });
}

/** Delete an empty sub-account after contract simulation passes. */
export function useDeleteSubAccount() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: DeleteSubAccountParameters) =>
      confirmTransaction(config, chainId, deleteSubAccount(config, { ...variables, chainId })),
    onSuccess: () => invalidate(queryClient, chainId, ["subAccounts", "balanceOf", "balanceInfo"]),
  });
}

/** Isolation-aware withdrawal preparation and request submission. */
export function useWithdrawAuto() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  const { subAccountDetail } = useSubAccount();
  return useMutation({
    mutationFn: (variables: Omit<WithdrawAutoParameters, "chainId" | "isolationType">) =>
      confirmTransaction(
        config,
        chainId,
        withdrawAuto(config, { ...variables, chainId, isolationType: subAccountDetail?.isolationType }),
      ),
    onSuccess: () => invalidate(queryClient, chainId, ["pendingWithdraws", "balanceOf", "balanceInfo"]),
  });
}

/** Finalize a matured withdrawal request. */
export function useFinalizeWithdraw() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: FinalizeWithdrawRequestParameters) =>
      confirmTransaction(config, chainId, finalizeWithdrawRequest(config, { ...variables, chainId })),
    onSuccess: () => invalidate(queryClient, chainId, ["pendingWithdraws", "collateralBalance"]),
  });
}

/** Cancel a pending withdrawal request. */
export function useCancelWithdraw() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: RequestCancelWithdrawParameters) =>
      confirmTransaction(config, chainId, requestCancelWithdraw(config, { ...variables, chainId })),
    onSuccess: () => invalidate(queryClient, chainId, ["pendingWithdraws", "balanceInfo"]),
  });
}

/** Open a position via the active solver's instant flow. */
export function useInstantOpen() {
  const { config, chainId, solverId } = useSdkScope();
  const queryClient = useQueryClient();
  const { subAccount } = useSubAccount();
  const requireActiveTradingDelegation = useRequireActiveTradingDelegation();
  return useMutation({
    mutationFn: async (
      variables: Omit<PrepareInstantOpenParameters, "subAccountAddress" | "from" | "chainId" | "solverId">,
    ) => {
      if (!subAccount) throw new Error("Select a sub-account first.");
      const sessionKeyAddress = await requireActiveTradingDelegation();
      return instantOpenAuto(config, {
        ...variables,
        chainId,
        solverId,
        subAccountAddress: subAccount,
        from: sessionKeyAddress,
      });
    },
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo"]),
  });
}

/** Place a resting LIMIT open on solvers that advertise limit-order support. */
export function useLimitOpen() {
  const { config, chainId, solverId } = useSdkScope();
  const queryClient = useQueryClient();
  const { subAccount } = useSubAccount();
  const requireActiveTradingDelegation = useRequireActiveTradingDelegation();
  return useMutation({
    mutationFn: async (
      variables: Omit<PrepareLimitOpenParameters, "subAccountAddress" | "from" | "chainId" | "solverId">,
    ) => {
      if (!subAccount) throw new Error("Select a sub-account first.");
      const sessionKeyAddress = await requireActiveTradingDelegation();
      return limitOpenAuto(config, {
        ...variables,
        chainId,
        solverId,
        subAccountAddress: subAccount,
        from: sessionKeyAddress,
      });
    },
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo"]),
  });
}

/** Close or partially close a position through the active solver. */
export function useInstantClose() {
  const { config, chainId, solverId } = useSdkScope();
  const queryClient = useQueryClient();
  const requireActiveTradingDelegation = useRequireActiveTradingDelegation();
  return useMutation({
    mutationFn: async (variables: Omit<PrepareInstantCloseParameters, "from" | "chainId" | "solverId">) => {
      const sessionKeyAddress = await requireActiveTradingDelegation();
      return instantCloseAuto(config, { ...variables, chainId, solverId, from: sessionKeyAddress });
    },
    // Notifications and the hedger snapshot own quote lifecycle state.
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo"]),
  });
}

/** Submit multiple market-close intents in one signed solver batch. */
export function useInstantCloseBulk() {
  const { config, chainId, solverId } = useSdkScope();
  const queryClient = useQueryClient();
  const requireActiveTradingDelegation = useRequireActiveTradingDelegation();
  return useMutation({
    mutationFn: async (variables: Omit<InstantCloseBulkAutoParameters, "from" | "chainId" | "solverId">) => {
      const sessionKeyAddress = await requireActiveTradingDelegation();
      return instantCloseBulkAuto(config, { ...variables, chainId, solverId, from: sessionKeyAddress });
    },
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo"]),
  });
}

/** Submit a resting LIMIT close on solvers that advertise limit-order support. */
export function useLimitClose() {
  const { config, chainId, solverId } = useSdkScope();
  const queryClient = useQueryClient();
  const requireActiveTradingDelegation = useRequireActiveTradingDelegation();
  return useMutation({
    mutationFn: async (variables: Omit<PrepareLimitCloseParameters, "from" | "chainId" | "solverId">) => {
      const sessionKeyAddress = await requireActiveTradingDelegation();
      return limitCloseAuto(config, { ...variables, chainId, solverId, from: sessionKeyAddress });
    },
    onSuccess: () => invalidate(queryClient, chainId, ["balanceOf", "balanceInfo"]),
  });
}

function useConfirmedQuoteAction<T extends { account: `0x${string}`; quoteId: bigint }>(
  action: (
    config: ReturnType<typeof useSdkScope>["config"],
    variables: T & { chainId: number; from?: `0x${string}` },
  ) => Promise<`0x${string}`>,
) {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  const { address } = useSigner();
  return useMutation({
    mutationFn: (variables: T) =>
      confirmTransaction(config, chainId, action(config, { ...variables, chainId, from: address })),
    onSuccess: () => invalidate(queryClient, chainId, ["managed-positions", "balanceOf", "balanceInfo"]),
  });
}

/** Request cancellation of a pending open quote. */
export function useRequestCancelQuote() {
  return useConfirmedQuoteAction<RequestToCancelQuoteParameters>(requestToCancelQuote);
}

/** Finish cancellation of a stalled pending open after its cooldown. */
export function useForceCancelQuote() {
  return useConfirmedQuoteAction<ForceCancelQuoteParameters>(forceCancelQuote);
}

/** Request cancellation of a pending close. */
export function useRequestCancelClose() {
  return useConfirmedQuoteAction<RequestToCancelCloseRequestParameters>(requestToCancelCloseRequest);
}

/** Finish cancellation of a stalled pending close after its cooldown. */
export function useForceCancelClose() {
  return useConfirmedQuoteAction<ForceCancelCloseRequestParameters>(forceCancelCloseRequest);
}

/** Force-close an eligible stalled LIMIT close with SDK price/Muon preflight. */
export function useForceClose() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  const { address } = useSigner();
  return useMutation({
    mutationFn: (variables: Omit<ForceCloseAutoParameters, "chainId" | "from">) =>
      confirmTransaction(config, chainId, forceCloseAuto(config, { ...variables, chainId, from: address })),
    onSuccess: () => invalidate(queryClient, chainId, ["managed-positions", "balanceOf", "balanceInfo"]),
  });
}

/** Attach or update TP/SL on a position. */
export function useSetTpSl() {
  const { config, chainId } = useSdkScope();
  const queryClient = useQueryClient();
  const requireActiveTradingDelegation = useRequireActiveTradingDelegation();
  return useMutation({
    mutationFn: async (variables: Omit<SetQuoteTpSlParameters, "from" | "chainId">) => {
      const sessionKeyAddress = await requireActiveTradingDelegation();
      return setQuoteTpSl(config, { ...variables, chainId, from: sessionKeyAddress });
    },
    onSuccess: () => invalidate(queryClient, chainId, [TPSL_QUERY_KEY]),
  });
}
