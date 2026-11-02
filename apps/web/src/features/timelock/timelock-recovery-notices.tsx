"use client";

import { ResultWarning } from "@/components/result";
import { Button } from "@symmio/ui/components/button";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Notice = { key: string; account: string; recovery: string; clear: () => Promise<void> };
type Registry = {
  register: (id: string, notice: Notice) => void;
  unregister: (id: string) => void;
  begin: (key: string) => void;
  end: (key: string) => void;
  active: ReadonlyMap<string, number>;
  entries: ReadonlyMap<string, Notice>;
};
const RecoveryNoticeContext = createContext<Registry | null>(null);

export function useRecoveryNoticeRegistry() {
  return useContext(RecoveryNoticeContext);
}

/** Group notices by root account while leaving recovery ownership in each write hook. */
export function TimelockRecoveryNoticeProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, Notice>>(() => new Map());
  const [active, setActive] = useState<Map<string, number>>(() => new Map());
  const register = useCallback((id: string, notice: Notice) => setEntries((old) => new Map(old).set(id, notice)), []);
  const unregister = useCallback(
    (id: string) =>
      setEntries((old) => {
        if (!old.has(id)) return old;
        const next = new Map(old);
        next.delete(id);
        return next;
      }),
    [],
  );
  const begin = useCallback((key: string) => setActive((old) => new Map(old).set(key, (old.get(key) ?? 0) + 1)), []);
  const end = useCallback(
    (key: string) =>
      setActive((old) => {
        const next = new Map(old);
        const count = next.get(key) ?? 0;
        if (count <= 1) next.delete(key);
        else next.set(key, count - 1);
        return next;
      }),
    [],
  );
  const value = useMemo(
    () => ({ register, unregister, begin, end, active, entries }),
    [register, unregister, begin, end, active, entries],
  );
  return <RecoveryNoticeContext.Provider value={value}>{children}</RecoveryNoticeContext.Provider>;
}

/** Show one notice for each affected account, independently of its number of cards. */
export function TimelockRecoveryNotices() {
  const registry = useRecoveryNoticeRegistry();
  const byAccount = new Map<string, Notice>();
  if (registry)
    for (const notice of registry.entries.values())
      if (!registry.active.has(notice.key)) byAccount.set(notice.key, notice);
  return byAccount.size ? (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4" data-testid="timelock-recovery-notices">
      {Array.from(byAccount.values()).map((notice) => (
        <ResultWarning key={notice.key}>
          An earlier protected operation for account {notice.account} needs reconciliation.
          <details>
            <summary>Saved recovery details</summary>
            <pre className="max-h-64 overflow-auto text-xs break-all whitespace-pre-wrap">{notice.recovery}</pre>
          </details>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm("Have you reconciled every listed approval and transaction?")) void notice.clear();
            }}
          >
            Clear after reconciliation
          </Button>
        </ResultWarning>
      ))}
    </div>
  ) : null;
}
