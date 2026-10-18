/**
 * Resolves `@symmio/utils`'s root entry and every named subpath export under
 * `moduleResolution: nodenext`.
 *
 * Do not add feature checks here: no named types, functions, fields or usage
 * examples for new APIs. Unit tests in the owning package cover API shapes; here
 * they only duplicate them and fail CI's `verify-packages` step on every rename.
 * Edit this file only when a package or subpath export is added or removed (see README.md).
 */
import * as utils from "@symmio/utils";
import * as address from "@symmio/utils/address";
import * as amounts from "@symmio/utils/amounts";
import * as decimal from "@symmio/utils/decimal";
import * as format from "@symmio/utils/format";

void [utils, amounts, address, decimal, format];
