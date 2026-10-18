/**
 * Resolves `@symmio/session-key`'s root entry under `moduleResolution: nodenext`.
 *
 * Do not add feature checks here: no named types, functions, fields or usage
 * examples for new APIs. Unit tests in the owning package cover API shapes; here
 * they only duplicate them and fail CI's `verify-packages` step on every rename.
 * Edit this file only when a package or subpath export is added or removed (see README.md).
 */
import * as session from "@symmio/session-key";

void session;
