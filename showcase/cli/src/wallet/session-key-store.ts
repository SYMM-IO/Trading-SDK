import type { SessionKeyMetadata, SessionKeyRecord, SessionKeyStorage } from "@symmio/session-key";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * A file-backed {@link SessionKeyStorage} for the terminal. The hot signer's
 * private key is persisted to `<dir>/session-keys.json` with `0600` permissions
 * so instant trades survive across runs without re-granting delegation.
 *
 * SECURITY: this is a hot key at rest, obfuscation-free by design — the trust
 * boundary is the file mode and the machine. Delegation caps its blast radius
 * (only the granted instant-trade selectors, and only until expiry), but treat
 * the keystore like any credential file.
 */
interface KeystoreFile {
  version: 1;
  records: Record<string, SessionKeyRecord>;
}

function ownerKey(owner: string): string {
  return owner.toLowerCase();
}

async function readFileStore(path: string): Promise<KeystoreFile> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<KeystoreFile>;
    if (parsed && parsed.version === 1 && parsed.records) {
      return { version: 1, records: parsed.records };
    }
  } catch {
    /* missing or corrupt — start fresh */
  }
  return { version: 1, records: {} };
}

async function writeFileStore(dir: string, path: string, data: KeystoreFile): Promise<void> {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await chmod(dir, 0o700).catch(() => {
    /* best-effort on platforms without POSIX modes */
  });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600).catch(() => {
    /* best-effort on platforms without POSIX modes */
  });
}

function toMetadata(record: SessionKeyRecord): SessionKeyMetadata {
  return {
    address: record.address,
    owner: record.owner,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

/** Create the file-backed keystore rooted at `dir`. */
export function createFileSessionKeyStorage(dir: string): SessionKeyStorage {
  const root = resolve(dir);
  const path = join(root, "session-keys.json");

  return {
    async load(owner) {
      const store = await readFileStore(path);
      const record = store.records[ownerKey(owner)];
      if (!record) return null;
      if (record.expiresAt && record.expiresAt <= Date.now()) {
        await this.remove(owner);
        return null;
      }
      return record;
    },
    async save(owner, record) {
      const store = await readFileStore(path);
      store.records[ownerKey(owner)] = record;
      await writeFileStore(root, path, store);
    },
    async remove(owner) {
      const store = await readFileStore(path);
      delete store.records[ownerKey(owner)];
      await writeFileStore(root, path, store);
    },
    async getMetadata(owner) {
      const record = await this.load(owner);
      return record ? toMetadata(record) : null;
    },
  };
}
