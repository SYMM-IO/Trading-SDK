/**
 * Resolves `@symmio/utils`'s root entry and every named subpath export under
 * `moduleResolution: nodenext`.
 */
import * as utils from "@symmio/utils";
import * as address from "@symmio/utils/address";
import * as amounts from "@symmio/utils/amounts";
import * as decimal from "@symmio/utils/decimal";
import * as format from "@symmio/utils/format";

void [utils, amounts, address, decimal, format];
