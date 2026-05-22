/**
 * Re-export of the amount helpers from `@symm-frontier/utils/amounts`.
 *
 * Apps that already depend on `@symm-frontier/react` get formatter access
 * without having to add `@symm-frontier/utils` to their `package.json`. Apps
 * that want raw access can depend on `@symm-frontier/utils` directly.
 */
export {
  decimalToRaw,
  formatTokenAmount,
  parseTokenAmount,
  rawToDecimal,
  type FormatTokenAmountOptions,
} from "@symm-frontier/utils/amounts";
