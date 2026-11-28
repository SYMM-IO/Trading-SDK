import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchMockerConfig } from "../apps/web/src/config/mocker-config.ts";

const TAG = "[dev:mocker]";
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const e2e = process.argv.includes("--e2e");
const children = new Set<ChildProcess>();
let stopMocker: (() => Promise<void>) | undefined;
let stopping = false;

function readPort(name: string, fallback: number, max: number): number {
  const port = Number(process.env[name]?.trim() || fallback);
  if (!Number.isInteger(port) || port < 1 || port > max) {
    throw new Error(`${name} must be an integer from 1 to ${max}.`);
  }
  return port;
}

function mockerDirectory(): string {
  const raw = process.env.MOCKER_DIR?.trim();
  if (!raw) throw new Error("Set MOCKER_DIR to your MOCKER checkout in the repository root's .env.local.");
  const expanded = raw === "~" || raw.startsWith("~/") ? join(homedir(), raw.slice(1)) : raw;
  const dir = resolve(repoRoot, expanded);
  if (!existsSync(join(dir, "src", "main.ts")) || !existsSync(join(dir, "package.json"))) {
    throw new Error(`MOCKER_DIR=${dir} does not point to a MOCKER checkout.`);
  }
  return dir;
}

async function run(args: string[], cwd: string): Promise<void> {
  console.log(`${TAG} pnpm ${args.join(" ")}`);
  await new Promise<void>((done, fail) => {
    const child = spawn("pnpm", args, { cwd, stdio: "inherit" });
    child.once("error", fail);
    child.once("exit", (code) => (code === 0 ? done() : fail(new Error(`pnpm ${args.join(" ")} failed.`))));
  });
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function stop(code: number): void {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) signalGroup(child, "SIGINT");
  setTimeout(() => {
    for (const child of children) signalGroup(child, "SIGKILL");
    process.exit(code || 1);
  }, 10_000).unref();
  void stopMocker?.().catch((error: unknown) => {
    console.error(`${TAG} MOCKER shutdown failed`, error);
    process.exitCode = 1;
  });
}

function start(name: string, args: string[], cwd: string, env: Record<string, string>): void {
  const child = spawn("pnpm", args, { cwd, stdio: "inherit", detached: true, env: { ...process.env, ...env } });
  children.add(child);
  child.once("error", (error) => {
    children.delete(child);
    console.error(`${TAG} Could not start ${name}: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    console.error(`${TAG} ${name} stopped (${signal ?? `exit ${code}`}).`);
    stop(code || 1);
  });
}

async function waitForMocker(url: string) {
  const deadline = Date.now() + 60_000;
  while (!stopping && Date.now() < deadline) {
    const config = await fetchMockerConfig(url);
    if (config) return config;
    await delay(500);
  }
  if (!stopping) throw new Error(`MOCKER did not answer at ${url} within 60 seconds.`);
}

async function startIsolatedMocker(dir: string, basePort: number): Promise<void> {
  const entry = pathToFileURL(join(dir, "src", "main.ts")).href;
  const { startMocker } = (await import(entry)) as {
    startMocker: (
      overrides: { basePort: number },
      options: { stateMode: "off"; autoDelegate: "all" },
    ) => Promise<{ stop: () => Promise<void> }>;
  };
  const instance = await startMocker({ basePort }, { stateMode: "off", autoDelegate: "all" });
  if (stopping) await instance.stop();
  else stopMocker = instance.stop;
}

async function main(): Promise<void> {
  const basePort = readPort("MOCKER_BASE_PORT", e2e ? 14600 : 4600, 65_526);
  const webPort = readPort("MOCKER_WEB_PORT", e2e ? 13001 : 3001, 65_535);
  const mockerUrl = `http://localhost:${basePort}`;
  let config = e2e ? undefined : await fetchMockerConfig(mockerUrl);
  const dir = config ? undefined : mockerDirectory();
  if (dir && !existsSync(join(dir, "node_modules"))) await run(["install"], dir);
  if (!e2e && dir && !existsSync(join(dir, "panel", "dist", "index.html"))) await run(["build"], dir);
  await run(["exec", "turbo", "run", "build", "--filter=@symmio/web^..."], repoRoot);

  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
  if (dir) {
    if (e2e) await startIsolatedMocker(dir, basePort);
    else start("MOCKER", ["start"], dir, { MOCKER_BASE_PORT: String(basePort) });
    config = await waitForMocker(mockerUrl);
  } else {
    console.log(`${TAG} Using MOCKER at ${mockerUrl}.`);
  }
  if (stopping || !config) return;

  start("apps/web", ["--filter", "@symmio/web", "exec", "next", "dev", "-p", String(webPort)], repoRoot, {
    NEXT_PUBLIC_MOCKER_CONFIG: JSON.stringify(config),
    ...(e2e
      ? {
          MOCKER_E2E: "1",
          NEXT_PUBLIC_E2E_MODE: "1",
          NEXT_PUBLIC_E2E_ACCOUNT_ADDRESS: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        }
      : {}),
  });
  console.log(`${TAG} MOCKER at ${mockerUrl}, app starting at http://localhost:${webPort}.`);
}

void main().catch((error: unknown) => {
  console.error(`${TAG} ${error instanceof Error ? error.message : String(error)}`);
  stop(1);
});
