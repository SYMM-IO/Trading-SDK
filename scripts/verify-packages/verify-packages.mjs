/**
 * Verify the PUBLISHED shape of the workspace packages — the compiled JS, the generated
 * `.d.ts`, and the `package.json` `exports`/`files` manifest — the way a real npm consumer
 * sees them, not through the workspace's `workspace:*` symlinks.
 *
 * Two layers:
 *   1. `publint` (packaging/`files` manifest) + `@arethetypeswrong/cli` (type resolution across
 *      module modes) on the packed tarballs. The runtime SDK packages are ESM-only, so attw runs
 *      with `--profile esm-only` (no-CJS is intentional, not a defect).
 *   2. A real consumer OUTSIDE the workspace that installs the packed tarballs + real peers,
 *      typechecks the root + every subpath under strict `nodenext`, and runtime-imports each.
 *
 * Pass `--layer1-only` to skip the consumer install (offline, fast — used as the pre-publish gate).
 *
 * @example
 *   node scripts/verify-packages/verify-packages.mjs
 *   node scripts/verify-packages/verify-packages.mjs --layer1-only
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const layer1Only = process.argv.includes("--layer1-only");

/** Runtime SDK packages: ESM-only, checked by publint + attw + the consumer. */
const RUNTIME_PACKAGES = ["trading-core", "trading-react", "session-key", "utils"];
/** ESM tooling package: checked by publint + attw, but not consumed by the smoke consumer. */
const TOOLING_PACKAGES = ["eslint-config"];
/** Ships raw JSON configs (no `dist`/`exports`): only a tarball-contents presence check. */
const CONFIG_PACKAGES = ["typescript-config"];

/** Peer + type deps the consumer needs; versions mirror the repo's own pins. */
const CONSUMER_PEERS = {
  react: "^19.2.7",
  "react-dom": "^19.2.7",
  viem: "^2.49.0",
  wagmi: "^3.4.2",
};
const CONSUMER_DEV = {
  typescript: "^6.0.3",
  "@types/node": "^25.6.0",
  "@types/react": "^19.2.17",
  "@types/react-dom": "^19.2.3",
};
/** Internal `@symmio/*` deps that must resolve to the LOCAL tarballs, not the registry. */
const INTERNAL_OVERRIDES = ["@symmio/trading-core", "@symmio/utils"];

const failures = [];
function fail(label, detail) {
  failures.push({ label, detail });
  console.error(`\n✗ ${label}\n${detail}\n`);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", cwd: repoRoot, ...opts });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** `@symmio/trading-core` @ `0.1.2` → `symmio-trading-core-0.1.2.tgz`. */
function tarballName(pkgJson) {
  return `${pkgJson.name.replace("@", "").replace("/", "-")}-${pkgJson.version}.tgz`;
}

function main() {
  console.log("• Building packages…");
  const build = run("pnpm", ["turbo", "run", "build", "--filter=./packages/*"], { stdio: "inherit" });
  if (build.status !== 0) {
    fail("build", "turbo build failed — see output above.");
    return finish();
  }

  const tmp = mkdtempSync(join(tmpdir(), "symm-verify-"));
  const tarballsDir = join(tmp, "tarballs");
  const consumerDir = join(tmp, "consumer");

  // Pack every published package once; reuse the tarballs across both layers.
  const packed = {};
  for (const name of [...RUNTIME_PACKAGES, ...TOOLING_PACKAGES, ...CONFIG_PACKAGES]) {
    const pkgDir = join(repoRoot, "packages", name);
    const pkgJson = readJson(join(pkgDir, "package.json"));
    const pack = run("pnpm", ["pack", "--pack-destination", tarballsDir], { cwd: pkgDir });
    const tarball = join(tarballsDir, tarballName(pkgJson));
    if (pack.status !== 0 || !existsSync(tarball)) {
      fail(`pack ${pkgJson.name}`, pack.stderr || `expected ${tarball}`);
      continue;
    }
    packed[name] = { pkgJson, tarball };
  }

  console.log("\n• Layer 1 — publint + attw on packed tarballs");
  for (const name of [...RUNTIME_PACKAGES, ...TOOLING_PACKAGES]) {
    const entry = packed[name];
    if (!entry) continue;
    const publint = run("pnpm", ["exec", "publint", entry.tarball]);
    if (publint.status !== 0) fail(`publint ${entry.pkgJson.name}`, publint.stdout + publint.stderr);
    const attw = run("pnpm", ["exec", "attw", entry.tarball, "--profile", "esm-only"]);
    if (attw.status !== 0) fail(`attw ${entry.pkgJson.name}`, attw.stdout + attw.stderr);
    if (publint.status === 0 && attw.status === 0) console.log(`  ✓ ${entry.pkgJson.name}`);
  }
  for (const name of CONFIG_PACKAGES) {
    const entry = packed[name];
    if (!entry) continue;
    verifyConfigTarball(entry);
  }

  if (!layer1Only) {
    console.log("\n• Layer 2 — consumer install + nodenext typecheck + runtime import");
    verifyConsumer(packed, consumerDir);
  }

  finish(tmp);
}

/** A no-`dist` config package: assert its declared `files` are all present in the tarball. */
function verifyConfigTarball({ pkgJson, tarball }) {
  const listed = run("tar", ["-tzf", tarball]);
  if (listed.status !== 0) {
    fail(`tar ${pkgJson.name}`, listed.stderr);
    return;
  }
  const contents = new Set(listed.stdout.split("\n"));
  const missing = (pkgJson.files ?? []).filter((f) => !contents.has(`package/${f}`));
  if (!contents.has("package/package.json")) missing.push("package.json");
  if (missing.length) fail(`files ${pkgJson.name}`, `missing from tarball: ${missing.join(", ")}`);
  else console.log(`  ✓ ${pkgJson.name} (${(pkgJson.files ?? []).length} config files present)`);
}

function verifyConsumer(packed, consumerDir) {
  cpSync(join(scriptDir, "published-smoke"), consumerDir, { recursive: true });

  const dependencies = { ...CONSUMER_PEERS };
  const overrides = {};
  for (const name of RUNTIME_PACKAGES) {
    const entry = packed[name];
    if (!entry) return fail("consumer", `runtime package not packed: ${name}`);
    const spec = `file:${entry.tarball}`;
    dependencies[entry.pkgJson.name] = spec;
    if (INTERNAL_OVERRIDES.includes(entry.pkgJson.name)) overrides[entry.pkgJson.name] = spec;
  }
  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "symm-published-smoke",
        private: true,
        type: "module",
        dependencies,
        devDependencies: CONSUMER_DEV,
        pnpm: { overrides },
      },
      null,
      2,
    ),
  );

  const install = run("pnpm", ["install", "--ignore-workspace"], { cwd: consumerDir, stdio: "inherit" });
  if (install.status !== 0) return fail("consumer install", "pnpm install failed in the smoke consumer.");

  const tsc = run("pnpm", ["exec", "tsc", "--noEmit"], { cwd: consumerDir });
  if (tsc.status !== 0) fail("consumer nodenext typecheck", tsc.stdout + tsc.stderr);
  else console.log("  ✓ nodenext typecheck");

  const probe = run("node", ["runtime-probe.mjs"], { cwd: consumerDir });
  if (probe.status !== 0) fail("consumer runtime import", probe.stdout + probe.stderr);
  else console.log("  ✓ runtime import (all entrypoints loaded)");
}

function finish(tmp) {
  if (failures.length === 0) {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    console.log("\n✅ verify-packages: all checks passed.");
    process.exit(0);
  }
  if (tmp) console.error(`\n(kept temp dir for debugging: ${tmp})`);
  console.error(`\n❌ verify-packages: ${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`   - ${f.label}`);
  process.exit(1);
}

main();
