import { STAGING_CHAIN_OVERRIDES } from "@/config/symmio-presets";
import type { CreateConfigParameters } from "@symmio/trading-core";

type ChainOverrides = CreateConfigParameters["symmioConfig"];

/** Restore the staging deployment's capability for older saved staging configurations. */
export function rebaseStagingTimelockCapability(overrides: ChainOverrides): ChainOverrides {
  const staging = STAGING_CHAIN_OVERRIDES[42161];
  const chain = overrides?.[42161];
  const solver = chain?.solvers?.enigma;
  if (
    !chain ||
    !solver ||
    solver.capabilities?.timelockApproval !== undefined ||
    chain.addresses?.accountLayerAddress?.toLowerCase() !== staging.addresses.accountLayerAddress.toLowerCase() ||
    chain.addresses?.instantLayerAddress?.toLowerCase() !== staging.addresses.instantLayerAddress.toLowerCase() ||
    solver.url !== staging.solvers.enigma.url
  )
    return overrides;
  return {
    ...overrides,
    42161: {
      ...chain,
      solvers: {
        ...chain.solvers,
        enigma: { ...solver, capabilities: { ...solver.capabilities, timelockApproval: true } },
      },
    },
  };
}
