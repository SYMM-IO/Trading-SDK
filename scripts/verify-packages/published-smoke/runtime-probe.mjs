/**
 * Actually loads every published entrypoint in Node ESM. Unlike `tsc`, this catches a
 * `dist` file that is declared in `exports` but missing from the tarball: the type check
 * passes (the `.d.ts` is present) while the runtime import throws ERR_MODULE_NOT_FOUND.
 * Run from the generated consumer directory (see scripts/verify-packages/verify-packages.mjs).
 */
const specs = [
  "@symmio/trading-core",
  "@symmio/utils",
  "@symmio/utils/amounts",
  "@symmio/utils/address",
  "@symmio/utils/decimal",
  "@symmio/utils/format",
  "@symmio/session-key",
  "@symmio/trading-react",
  "@symmio/trading-react/provider",
  "@symmio/trading-react/account-layer",
  "@symmio/trading-react/instant-layer",
  "@symmio/trading-react/wallet",
  "@symmio/trading-react/errors",
  "@symmio/trading-react/transactions",
  "@symmio/trading-react/markets",
  "@symmio/trading-react/fees",
  "@symmio/trading-react/price-service",
  "@symmio/trading-react/candles",
];

let failures = 0;
for (const spec of specs) {
  try {
    await import(spec);
    console.log(`OK    ${spec}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${spec}  →  ${err.code ?? err.message}`);
  }
}
console.log(`\n${failures === 0 ? `all ${specs.length} imports loaded` : `${failures} import(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
