"use client";

import { useConsoleStorageKey } from "@/features/wallet/mocker-connection";
import { createSessionKeyManager, type SessionKeyManager } from "@symmio/session-key";
import { createBrowserSessionKeyStorage } from "./browser-session-key-storage";

const STORAGE_PREFIX = "session-key";
const managers = new Map<string, SessionKeyManager>();

export function getAppSessionKeyManager(storagePrefix = STORAGE_PREFIX): SessionKeyManager {
  const existing = managers.get(storagePrefix);
  if (existing) return existing;
  const manager = createSessionKeyManager({
    onLoadError: "throw",
    storage: createBrowserSessionKeyStorage({ storagePrefix }),
  });
  managers.set(storagePrefix, manager);
  return manager;
}

export function useAppSessionKeyManager(): SessionKeyManager {
  return getAppSessionKeyManager(useConsoleStorageKey(STORAGE_PREFIX));
}
