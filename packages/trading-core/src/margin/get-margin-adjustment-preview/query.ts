import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMarginAdjustmentPreview, type GetMarginAdjustmentPreviewParameters } from "./get-margin-adjustment-preview";

/** Build a preview key including identity, amount, mark and deployment fingerprint. */
export function getMarginAdjustmentPreviewQueryKey(
  parameters: GetMarginAdjustmentPreviewParameters & ConfigKeyParameter,
) {
  return ["getMarginAdjustmentPreview", filterQueryOptions({ ...parameters })] as const;
}

/** Query options for a margin preview. A submission must request a fresh preview. */
export function getMarginAdjustmentPreviewQueryOptions(
  config: Config,
  parameters: GetMarginAdjustmentPreviewParameters,
) {
  return {
    queryKey: getMarginAdjustmentPreviewQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    queryFn: () => getMarginAdjustmentPreview(config, parameters),
    staleTime: 0,
    retry: false as const,
  };
}
