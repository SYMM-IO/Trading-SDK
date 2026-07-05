/**
 * Make emitted declaration files NodeNext-correct.
 *
 * `vite-plugin-dts` emits `.d.ts` whose relative imports have no file extension
 * (`from "./config"`), which resolves fine under `moduleResolution: "bundler"`
 * but fails under `node16`/`nodenext` — where a `"type": "module"` package must
 * use fully-specified specifiers. This walks a built `dist/` and rewrites every
 * relative specifier to its NodeNext form, resolving file-vs-directory against
 * the emitted `.d.ts` set:
 *
 *   ./config      (config.d.ts exists)        -> ./config.js
 *   ./config      (config/index.d.ts exists)  -> ./config/index.js
 *   ..            (../index.d.ts exists)       -> ../index.js
 *
 * Resolving against the `.d.ts` set (not `.js` files) is what lets this handle
 * type-only modules and re-export-only barrels, which have no `.js` twin.
 *
 * Runs as a post-`vite build` step (see each package's `build` script). The `.js`
 * output already ships correct extensions from Rollup, so only `.d.ts` is touched.
 *
 * @example
 *   node ../../scripts/fix-dts-extensions.mjs dist
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const distDir = resolve(process.argv[2] ?? "dist");
if (!existsSync(distDir)) {
  throw new Error(`fix-dts-extensions: directory not found: ${distDir}`);
}

/** Every `.d.ts` under a directory, recursively. */
function collectDeclarationFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...collectDeclarationFiles(path));
    } else if (path.endsWith(".d.ts")) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Matches the module specifier in `from "..."`, `export ... from "..."`, and
 * `import("...")` (dynamic import used in `.d.ts` type positions). Captures any
 * relative form: `.`, `..`, `./x`, `../x/y`.
 */
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*)(["'])(\.\.?(?:\/[^"']*)?)\2/g;

/** The NodeNext-correct form of a relative specifier, or null if already fine / unresolvable. */
function resolveSpecifier(fromDir, specifier) {
  if (/\.(js|mjs|cjs|json)$/.test(specifier)) return null;
  const target = resolve(fromDir, specifier);
  if (existsSync(`${target}.d.ts`)) return `${specifier}.js`;
  if (existsSync(join(target, "index.d.ts"))) return `${specifier}/index.js`;
  return null;
}

let specifiersRewritten = 0;
let filesRewritten = 0;
for (const file of collectDeclarationFiles(distDir)) {
  const fromDir = dirname(file);
  const original = readFileSync(file, "utf8");
  let touched = false;
  const updated = original.replace(SPECIFIER, (match, prefix, quote, specifier) => {
    const fixed = resolveSpecifier(fromDir, specifier);
    if (!fixed) return match;
    touched = true;
    specifiersRewritten++;
    return `${prefix}${quote}${fixed}${quote}`;
  });
  if (touched) {
    writeFileSync(file, updated);
    filesRewritten++;
  }
}

console.log(`fix-dts-extensions: rewrote ${specifiersRewritten} specifiers in ${filesRewritten} .d.ts files`);
