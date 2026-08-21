import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/** Which SDK package a symbol came from. */
export type SdkPackage = "core" | "react";

/** One SDK module, and how much of it Prism actually touches. */
export interface SliceCoverage {
  /** Module the package barrel re-exports from, e.g. `solvers/markets`. */
  slice: string;
  package: SdkPackage;
  /** How many symbols the barrel publishes from that module. */
  exported: number;
  /** The symbols Prism imports, in source order. */
  used: readonly string[];
}

/** An honest tally of how much of the SDK this app exercises. */
export interface SdkCoverage {
  /** Slices with at least one import, richest first. */
  slices: readonly SliceCoverage[];
  /** Distinct SDK symbols imported anywhere in `src`. */
  usedSymbols: number;
  /** Distinct symbols the two package barrels publish. */
  exportedSymbols: number;
  /** Slices with at least one import, out of every slice the barrels expose. */
  touchedSlices: number;
  totalSlices: number;
  /** App files that import from the SDK. */
  files: number;
  /** Symbols the barrels do not attribute to a module — reported, never hidden. */
  unclassified: readonly string[];
  /** Set when the source scan could not run; the panel says so instead of guessing. */
  unavailable?: string;
}

const PACKAGE_SPECIFIER: Record<SdkPackage, string> = {
  core: "@symmio/trading-core",
  react: "@symmio/trading-react",
};

/* `export { a, type B } from "./x";` — the shape both package barrels are written in,
   in source and in the published `.d.ts` alike (the emitted one uses single quotes). */
const RE_EXPORT = /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
/* `import { a, type B } from "@symmio/trading-core";` in app source. */
const SDK_IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*"(@symmio\/trading-(?:core|react))"/g;

/**
 * Count how much of the SDK Prism exercises, by reading source.
 *
 * **Server-only** — it touches `node:fs`, so it must be called from a server
 * component and its result passed down as a prop.
 *
 * Both halves are scanned rather than declared: the denominator comes from
 * parsing each package's own export barrel, and the numerator comes from
 * parsing every `import` in `src`. Nothing about this number can be inflated by
 * editing a list, and it cannot go stale as the app grows — which is the only
 * reason it is worth showing at all.
 */
export async function scanSdkUsage(): Promise<SdkCoverage> {
  try {
    const [core, react] = await Promise.all([readBarrel("core"), readBarrel("react")]);
    const barrels = [...core, ...react];

    const { used, files } = await readAppImports();

    const owner = new Map<string, { slice: string; package: SdkPackage }>();
    const exportedSymbols = new Set<string>();
    const exportedPerSlice = new Map<string, number>();

    for (const entry of barrels) {
      const key = sliceKey(entry.package, entry.slice);
      exportedPerSlice.set(key, (exportedPerSlice.get(key) ?? 0) + entry.symbols.length);
      for (const symbol of entry.symbols) {
        exportedSymbols.add(`${entry.package}:${symbol}`);
        if (!owner.has(`${entry.package}:${symbol}`)) {
          owner.set(`${entry.package}:${symbol}`, { slice: entry.slice, package: entry.package });
        }
      }
    }

    const usedPerSlice = new Map<string, string[]>();
    const unclassified: string[] = [];

    for (const [symbol, pkg] of used) {
      const found = owner.get(`${pkg}:${symbol}`) ?? owner.get(`core:${symbol}`) ?? owner.get(`react:${symbol}`);
      if (!found) {
        unclassified.push(symbol);
        continue;
      }
      const key = sliceKey(found.package, found.slice);
      const bucket = usedPerSlice.get(key);
      if (bucket) bucket.push(symbol);
      else usedPerSlice.set(key, [symbol]);
    }

    const slices: SliceCoverage[] = [...usedPerSlice.entries()]
      .map(([key, symbols]) => {
        const [pkg, ...rest] = key.split(":");
        return {
          slice: rest.join(":"),
          package: pkg as SdkPackage,
          exported: exportedPerSlice.get(key) ?? symbols.length,
          used: [...new Set(symbols)].sort((a, b) => a.localeCompare(b)),
        };
      })
      .sort((a, b) => b.used.length - a.used.length || a.slice.localeCompare(b.slice));

    return {
      slices,
      usedSymbols: used.size,
      exportedSymbols: exportedSymbols.size,
      touchedSlices: slices.length,
      totalSlices: exportedPerSlice.size,
      files,
      unclassified: [...new Set(unclassified)].sort((a, b) => a.localeCompare(b)),
    };
  } catch (error) {
    return {
      slices: [],
      usedSymbols: 0,
      exportedSymbols: 0,
      touchedSlices: 0,
      totalSlices: 0,
      files: 0,
      unclassified: [],
      unavailable: error instanceof Error ? error.message : String(error),
    };
  }
}

interface BarrelEntry {
  package: SdkPackage;
  slice: string;
  symbols: string[];
}

/**
 * Parse one package's export barrel into `module → symbols`.
 *
 * The published `dist/index.d.ts` keeps the barrel's shape, so this works
 * against an installed tarball and not only against a linked workspace — which
 * matters, because that is how Prism consumes the SDK. The source barrel is
 * tried second for the linked case.
 */
async function readBarrel(pkg: SdkPackage): Promise<BarrelEntry[]> {
  const source = strip(await readFirst(pkg, ["dist/index.d.ts", "src/index.ts"]));

  const entries: BarrelEntry[] = [];
  RE_EXPORT.lastIndex = 0;
  for (let match = RE_EXPORT.exec(source); match !== null; match = RE_EXPORT.exec(source)) {
    const from = match[2] ?? "";
    /* Skip cross-package re-exports: the react barrel republishes core symbols,
       and attributing those to react would double-count the same module. */
    if (!from.startsWith(".")) continue;
    const symbols = splitSpecifiers(match[1] ?? "");
    if (symbols.length > 0) entries.push({ package: pkg, slice: normalizeSlice(from), symbols });
  }
  return entries;
}

/** Every SDK symbol imported anywhere under `src`, with the file count. */
async function readAppImports(): Promise<{ used: Map<string, SdkPackage>; files: number }> {
  const used = new Map<string, SdkPackage>();
  let files = 0;

  for (const file of await listSourceFiles(join(process.cwd(), "src"))) {
    const source = strip(await readFile(file, "utf8"));
    let importsHere = false;

    SDK_IMPORT.lastIndex = 0;
    for (let match = SDK_IMPORT.exec(source); match !== null; match = SDK_IMPORT.exec(source)) {
      importsHere = true;
      const pkg: SdkPackage = match[2] === PACKAGE_SPECIFIER.react ? "react" : "core";
      for (const symbol of splitSpecifiers(match[1] ?? "")) {
        if (!used.has(symbol)) used.set(symbol, pkg);
      }
    }

    if (importsHere) files += 1;
  }

  return { used, files };
}

/** Recursively list every TypeScript source file under a directory. */
async function listSourceFiles(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await listSourceFiles(full)));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

/**
 * Remove comments and template literals before matching.
 *
 * Not cosmetic: this file's own neighbour quotes real `import` statements
 * inside a template literal so the page can display them, and counting those as
 * imports would inflate the tally with code the app does not run.
 */
function strip(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``");
}

/** Split an import/export specifier list into bare symbol names. */
function splitSpecifiers(list: string): string[] {
  return list
    .split(",")
    .map(
      (raw) =>
        raw
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]
          ?.trim() ?? "",
    )
    .filter((name) => name.length > 0 && !name.startsWith("*"));
}

/** Read the first candidate that exists inside an installed package. */
async function readFirst(pkg: SdkPackage, candidates: readonly string[]): Promise<string> {
  const root = join(process.cwd(), "node_modules", PACKAGE_SPECIFIER[pkg]);
  let last: unknown;
  for (const candidate of candidates) {
    try {
      return await readFile(join(root, ...candidate.split("/")), "utf8");
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error(`No barrel found for ${PACKAGE_SPECIFIER[pkg]}.`);
}

/** `./solvers/markets/index.js` and `./solvers/markets` are the same module. */
function normalizeSlice(from: string): string {
  return from
    .replace(/^\.\//, "")
    .replace(/^\.\.\//, "")
    .replace(/\.js$/, "")
    .replace(/\/index$/, "");
}

function sliceKey(pkg: SdkPackage, slice: string): string {
  return `${pkg}:${slice}`;
}
