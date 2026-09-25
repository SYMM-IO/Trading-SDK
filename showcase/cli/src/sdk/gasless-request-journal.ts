import { GaslessRequestStatus, type GaslessRelayEvent, type GaslessService } from "@symmio/trading-core";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Address } from "viem";
import { getKeystoreDir } from "../config/environment.js";

/** Public request metadata retained so accepted relays remain discoverable after a restart. */
export interface GaslessJournalEntry {
  requestId: string;
  service: GaslessService;
  chainId: number;
  protocolInstance: string | null;
  operationType: string | null;
  owner: Address;
  walletIds: readonly string[];
  status: GaslessRequestStatus;
  acceptedAt: number;
  updatedAt: number;
}

interface JournalFile {
  version: 1;
  requests: GaslessJournalEntry[];
}

const MAX_REQUESTS = 40;
const JOURNAL_FILE = "gasless-requests.json";

let writeQueue: Promise<void> = Promise.resolve();

function journalPath(): { directory: string; file: string; temporary: string } {
  const directory = resolve(getKeystoreDir());
  return {
    directory,
    file: join(directory, JOURNAL_FILE),
    temporary: join(directory, `${JOURNAL_FILE}.tmp`),
  };
}

function isJournalEntry(value: unknown): value is GaslessJournalEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<GaslessJournalEntry>;
  return (
    typeof candidate.requestId === "string" &&
    (candidate.service === "operations" || candidate.service === "deposits") &&
    typeof candidate.chainId === "number" &&
    typeof candidate.owner === "string" &&
    Array.isArray(candidate.walletIds) &&
    typeof candidate.acceptedAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
}

async function readJournal(): Promise<JournalFile> {
  const { file } = journalPath();
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<JournalFile>;
    if (parsed.version === 1 && Array.isArray(parsed.requests)) {
      return { version: 1, requests: parsed.requests.filter(isJournalEntry).slice(0, MAX_REQUESTS) };
    }
  } catch {
    /* A missing or corrupt non-secret journal starts empty. */
  }
  return { version: 1, requests: [] };
}

async function writeJournal(data: JournalFile): Promise<void> {
  const { directory, file, temporary } = journalPath();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => {
    /* Best effort on platforms without POSIX modes. */
  });
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600).catch(() => {
    /* Best effort on platforms without POSIX modes. */
  });
  await rename(temporary, file);
}

function enqueueWrite(update: (current: JournalFile) => JournalFile): Promise<void> {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const current = await readJournal();
      await writeJournal(update(current));
    });
  return writeQueue;
}

function sameRequest(left: GaslessJournalEntry, right: Pick<GaslessJournalEntry, "chainId" | "requestId" | "service">) {
  return left.chainId === right.chainId && left.requestId === right.requestId && left.service === right.service;
}

/** Load recent public request handles, newest first. No signatures, keys, or submit bodies are stored. */
export async function loadGaslessJournal(parameters: {
  chainId: number;
  owner?: Address;
  protocolInstance?: string | null;
}): Promise<GaslessJournalEntry[]> {
  const journal = await readJournal();
  const owner = parameters.owner?.toLowerCase();
  return journal.requests
    .filter((entry) => entry.chainId === parameters.chainId)
    .filter((entry) => !owner || entry.owner.toLowerCase() === owner)
    .filter(
      (entry) => parameters.protocolInstance === undefined || entry.protocolInstance === parameters.protocolInstance,
    )
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

/** Persist the public handle returned at HTTP acceptance, never the signed request body or wallet material. */
export function storeGaslessJournalEntry(entry: GaslessJournalEntry): Promise<void> {
  return enqueueWrite((current) => ({
    version: 1,
    requests: [entry, ...current.requests.filter((candidate) => !sameRequest(candidate, entry))]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_REQUESTS),
  }));
}

/** Update the terminal status of an already-journaled workflow. */
export function updateGaslessJournalStatus(parameters: {
  chainId: number;
  requestId: string;
  service: GaslessService;
  status: GaslessRequestStatus;
}): Promise<void> {
  return enqueueWrite((current) => ({
    version: 1,
    requests: current.requests.map((entry) =>
      sameRequest(entry, parameters) ? { ...entry, status: parameters.status, updatedAt: Date.now() } : entry,
    ),
  }));
}

/**
 * Config-level relay observer for future transparent gasless writes. Wiring it
 * into `gasless.execution.onEvent` journals only public lifecycle metadata.
 */
export function recordGaslessRelayEvent(event: GaslessRelayEvent): void {
  if (event.type === "accepted") {
    const now = Date.now();
    void storeGaslessJournalEntry({
      requestId: event.requestId,
      service: event.service,
      chainId: event.chainId,
      protocolInstance: event.protocolInstance,
      operationType: event.operationType,
      owner: event.owner,
      walletIds: event.walletIds.map(String),
      status: GaslessRequestStatus.QUEUED,
      acceptedAt: now,
      updatedAt: now,
    });
    return;
  }

  if (event.type === "terminal") {
    void enqueueWrite((current) => ({
      version: 1,
      requests: current.requests.map((entry) =>
        entry.chainId === event.chainId && entry.requestId === event.requestId
          ? { ...entry, status: event.status, updatedAt: Date.now() }
          : entry,
      ),
    }));
  }
}
