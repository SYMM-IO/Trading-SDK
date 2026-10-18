/**
 * Resolves `@symmio/trading-core`'s root entry under `moduleResolution: nodenext`.
 * Namespace form so this fails on a packaging/type-resolution defect, never on a
 * renamed export.
 *
 * Do not add feature checks here: no named types, functions, fields or usage
 * examples for new APIs. Unit tests in the owning package cover API shapes; here
 * they only duplicate them and fail CI's `verify-packages` step on every rename.
 * Edit this file only when a package or subpath export is added or removed (see README.md).
 */
import * as core from "@symmio/trading-core";

void core;
