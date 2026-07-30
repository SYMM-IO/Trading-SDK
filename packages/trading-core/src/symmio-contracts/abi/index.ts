/**
 * Public ABI re-exports. Versioned under `v0.8.5/` (the only supported SYMMIO
 * version today).
 *
 * @remarks
 * An earlier note here planned to route a second version through these static
 * re-exports. That approach is superseded: a static re-export can only ever
 * expose one version under a given name, so it cannot serve two chains running
 * different contract versions in the same application. Multi-version support is
 * specified as a runtime version-pack registry resolved from chain config — see
 * `ARCHITECTURE.md` at the package root.
 */
export { accountLayerAbi } from "./v0.8.5/account-layer";
export { instantLayerAbi } from "./v0.8.5/instant-layer";
export { symmioAbi } from "./v0.8.5/symmio";
