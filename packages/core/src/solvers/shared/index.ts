/**
 * Cross-slice shared utilities for the solver/hedger domain.
 *
 * Anything reused by ≥2 of the instant-open / instant-close / future
 * instant-* slices lives here. Slice-specific shared lives under each slice's
 * own `shared/` folder.
 */
export * from "./resolvers";
