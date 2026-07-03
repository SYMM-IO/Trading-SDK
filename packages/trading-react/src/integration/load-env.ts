/**
 * Loads the repo-root `.env` file into `process.env` for integration tests.
 *
 * @internal — integration-test scaffolding. Vitest runs in node and does
 *   not auto-load env files, so each integration suite calls this once at
 *   module top-level. Idempotent: subsequent calls are no-ops once the keys
 *   are present.
 *
 * Reads `.env` by walking up three directories from this file
 * (`<repo>/packages/trading-react/src/integration/` → `<repo>/`). Only sets keys
 * that are not already in `process.env`, so an explicit CI env wins.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dirname_ = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_ENV = resolve(dirname_, "..", "..", "..", "..", ".env");

let loaded = false;

export function loadIntegrationEnv(): void {
  if (loaded) return;
  loaded = true;

  let content: string;
  try {
    content = readFileSync(REPO_ROOT_ENV, "utf8");
  } catch {
    /** No `.env` at the repo root — leave `process.env` alone. */
    return;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    /** Strip optional surrounding quotes. */
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
