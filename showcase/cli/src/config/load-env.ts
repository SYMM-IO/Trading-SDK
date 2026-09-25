import { existsSync, readFileSync, statSync } from "node:fs";

const ENV_FILES = [".env", ".env.local"];
const PRIVATE_KEY_ASSIGNMENT = /^\s*(?:export\s+)?SYMMIO_PRIVATE_KEY\s*=/m;

function assertPrivateKeyFilePermissions(file: string): void {
  if (process.platform === "win32") return;

  const mode = statSync(file).mode & 0o777;
  if ((mode & 0o044) === 0) return;

  const contents = readFileSync(file, "utf8");
  if (!PRIVATE_KEY_ASSIGNMENT.test(contents)) return;

  const displayedMode = `0${mode.toString(8).padStart(3, "0")}`;
  process.stderr.write(
    `\nSYMMIO Frontier CLI\n\nSecurity check failed: refusing to load SYMMIO_PRIVATE_KEY from ${file} because it is group/world-readable (mode ${displayedMode}).\nRun \`chmod 600 ${file}\`, then restart the CLI.\n\n`,
  );
  process.exit(1);
}

/**
 * Load `.env` then `.env.local` (local overrides) into `process.env` before any
 * other module reads configuration. Imported first from the entry point — ESM
 * runs this side effect ahead of the modules that call `process.env`.
 *
 * Node ≥20.12 exposes `process.loadEnvFile`; on older runtimes this is a no-op
 * and the operator must export the variables themselves.
 */
for (const file of ENV_FILES) {
  if (existsSync(file)) assertPrivateKeyFilePermissions(file);
}

for (const file of ENV_FILES) {
  if (typeof process.loadEnvFile === "function" && existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* malformed file — ignore and fall back to the process environment */
    }
  }
}
