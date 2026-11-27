"use client";

import { connectMocker, MOCKER_AVAILABLE, MOCKER_URL, type MockerSession } from "@/config/mocker";
import { Button } from "@symmio/ui/components/button";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { watchConnection } from "wagmi/actions";

const storageKey = `symmio.mocker.wallet.${MOCKER_URL}`;

interface Connection {
  session?: MockerSession;
  enter: (signal: AbortSignal) => Promise<void>;
}

export const MockerConnectionContext = createContext<Connection | undefined>(undefined);

export function useMockerConnection() {
  return useContext(MockerConnectionContext);
}

/** Keep test accounts and their live data separate from the operator’s regular console. */
export function useConsoleStorageKey(key: string): string {
  return useMockerConnection()?.session ? `mocker.${MOCKER_URL}.${key}` : key;
}

function savedAccount(): string | undefined {
  try {
    return localStorage.getItem(storageKey) || undefined;
  } catch {
    return undefined;
  }
}

function remember(account?: string) {
  try {
    if (account) localStorage.setItem(storageKey, account);
    else localStorage.removeItem(storageKey);
  } catch {
    // The operator can still trade in this tab when browser storage is unavailable.
  }
}

export function mockerConnectionError(error: unknown) {
  const detail = error instanceof Error && !(error instanceof TypeError) ? ` ${error.message}` : "";
  return `Could not connect to MOCKER at ${MOCKER_URL}. Check that it is running and try again.${detail}`;
}

/** Mount the SDK only after the operator's saved environment has been restored. */
export function MockerConnectionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MockerSession>();
  const [restoring, setRestoring] = useState(MOCKER_AVAILABLE);
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);
  const restoreRequest = useRef<AbortController | null>(null);

  const enter = useCallback(async (signal: AbortSignal, account?: string) => {
    const local = await connectMocker(signal, account);
    signal.throwIfAborted();
    remember(local.account);
    setSession(local);
    setRestoring(false);
  }, []);

  const leave = useCallback(() => {
    restoreRequest.current?.abort();
    remember();
    setSession(undefined);
    setRestoring(false);
    setFailure("");
  }, []);

  useEffect(() => {
    if (!MOCKER_AVAILABLE) return;
    const account = savedAccount();
    if (!account) {
      setRestoring(false);
      return;
    }
    const controller = new AbortController();
    restoreRequest.current = controller;
    setFailure("");
    void enter(controller.signal, account).catch((error) => {
      if (!controller.signal.aborted) setFailure(mockerConnectionError(error));
    });
    return () => controller.abort();
  }, [attempt, enter]);

  useEffect(() => {
    if (session)
      return watchConnection(session.wagmi, {
        onChange(connection) {
          if (connection.status === "disconnected") leave();
        },
      });
  }, [session, leave]);

  if (restoring)
    return (
      <main className="mx-auto flex max-w-lg flex-col items-start gap-4 px-6 py-16">
        <p role={failure ? "alert" : "status"}>{failure || "Restoring wallet connection…"}</p>
        {failure && (
          <div className="flex gap-2">
            <Button onClick={() => setAttempt((value) => value + 1)}>Retry</Button>
            <Button variant="outline" onClick={leave}>
              Use regular wallets
            </Button>
          </div>
        )}
      </main>
    );
  return (
    <MockerConnectionContext.Provider value={MOCKER_AVAILABLE ? { session, enter } : undefined}>
      {children}
    </MockerConnectionContext.Provider>
  );
}
