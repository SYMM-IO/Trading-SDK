import {
  confirmGaslessRequest,
  getMarginAdjustmentPreview,
  type Config,
  type GetMarginAdjustmentPreviewParameters,
} from "../../../packages/trading-core/src/index";
import {
  useAddMargin,
  useMarginAdjustmentPreview,
  usePositionLiquidationState,
  type UsePositionLiquidationStateParameters,
} from "../../../packages/trading-react/src/index";

/** Compilable example: the host application supplies verified identity and marks. */
export function MarginRiskExample({
  config,
  parameters,
  snapshot,
}: {
  config: Config;
  parameters: GetMarginAdjustmentPreviewParameters;
  snapshot: UsePositionLiquidationStateParameters;
}) {
  const preview = useMarginAdjustmentPreview({ ...parameters, config });
  const risk = usePositionLiquidationState(snapshot);
  const add = useAddMargin({ config, invalidateOnSuccess: false, waitForReceipt: false });
  async function submit() {
    const fresh = await getMarginAdjustmentPreview(config, parameters);
    if (fresh.simulation !== "success" || parameters.direction !== "add") return;
    await add.mutateAsync({
      chainId: parameters.chainId,
      virtualAccount: parameters.virtualAccount,
      amount: parameters.amount,
      from: parameters.signer,
      gasless: {
        enabled: true,
        fallback: "error",
        account: parameters.subAccount,
        onAccepted(request) {
          // Persist request.requestId with the captured operation before observing.
          void confirmGaslessRequest(config, {
            chainId: parameters.chainId,
            requestId: request.requestId,
            until: "receipt",
          }).catch(() => {
            /* Retain uncertainty; resume status observation. */
          });
        },
      },
    });
  }
  return (
    <button
      disabled={!preview.isFresh || preview.isFetching || preview.data?.simulation !== "success" || add.isPending}
      onClick={() => void submit()}
    >
      {risk.status === "ready" ? "Add margin" : "Risk unavailable"}
    </button>
  );
}
