"use client";

import { createSessionKeyManager, type SessionKeyManager } from "@symm-frontier/session-key";
import { createBrowserSessionKeyStorage } from "./browser-session-key-storage";

const STORAGE_PREFIX = "symm-frontier-session-key";
let manager: SessionKeyManager | null = null;

export function getAppSessionKeyManager(): SessionKeyManager {
  if (manager) return manager;

  manager = createSessionKeyManager({
    storage: createBrowserSessionKeyStorage({
      storagePrefix: STORAGE_PREFIX,
    }),
  });

  return manager;
}
