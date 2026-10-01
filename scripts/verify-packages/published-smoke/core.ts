/**
 * Resolves `@symmio/trading-core`'s root entry under `moduleResolution: nodenext`.
 * Namespace form so this fails on a packaging/type-resolution defect, never on a
 * renamed export.
 */
import * as core from "@symmio/trading-core";

void core;
