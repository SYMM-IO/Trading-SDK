"use client";

import { AddressTag } from "@/components/address-tag";
import { DataList, DataRow } from "@/components/data-list";
import { ResultError, ResultNote } from "@/components/result";
import { Button } from "@symm-frontier/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symm-frontier/ui/components/card";
import { Input } from "@symm-frontier/ui/components/input";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { formatRelativeTimestamp } from "@symm-frontier/utils";
import { useState } from "react";
import type { Hex } from "viem";
import { isHex } from "viem";
import { useSessionKey } from "./use-session-key";

interface SignResult {
  message: string;
  signature: Hex;
  sessionKeyAddress: string;
  durationMs: number;
}

export function LocalSessionKeyCard() {
  const {
    owner,
    sessionKeyAddress,
    state,
    metadata,
    isLoading,
    isSigning,
    error,
    initialize,
    rotate,
    importPrivateKey,
    destroy,
    signMessage,
    getPrivateKey,
  } = useSessionKey();
  const [importValue, setImportValue] = useState("");
  const [message, setMessage] = useState("");
  const [signResult, setSignResult] = useState<SignResult | null>(null);
  const privateKey = getPrivateKey();
  const isReady = Boolean(sessionKeyAddress && state.isReady);
  const validImportPrivateKey = parsePrivateKey(importValue);

  return (
    <Card data-testid="card-local-session-key">
      <CardHeader>
        <CardTitle>Local session key</CardTitle>
        <CardDescription>
          Generate or load a browser-local session key for Instant Layer signatures. The private key is encrypted in
          localStorage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <DataList>
            <DataRow label="owner" value={owner ? <AddressTag address={owner} /> : "Connect wallet"} />
            <DataRow
              label="session key"
              value={sessionKeyAddress ? <AddressTag address={sessionKeyAddress} /> : "Not initialized"}
            />
            <DataRow label="expires" value={metadata ? formatExpiry(metadata.expiresAt) : "Not initialized"} />
            <DataRow
              label="private key"
              value={privateKey ? "Encrypted at rest; loaded in memory" : "Not loaded"}
              copyValue={privateKey ?? undefined}
            />
          </DataList>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!owner || isLoading}
              onClick={() => void initialize()}
              data-testid="button-initialize-session-key"
            >
              {isLoading && !isReady ? (
                <>
                  <Spinner className="size-4" /> Initializing...
                </>
              ) : (
                "Initialize"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!owner || isLoading}
              onClick={() => void rotate()}
              data-testid="button-rotate-session-key"
            >
              {isLoading && isReady ? (
                <>
                  <Spinner className="size-4" /> Rotating...
                </>
              ) : (
                "Rotate"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!owner || !isReady || isLoading}
              onClick={() => void destroy()}
              data-testid="button-destroy-session-key"
            >
              Destroy
            </Button>
          </div>

          <div className="border-border/70 bg-muted/20 space-y-3 rounded-xl border p-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="session-key-import-private-key" className="text-sm font-medium">
                Import private key
              </label>
              <p className="text-muted-foreground text-xs">
                Replace the current local session key with a private key from another device.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="session-key-import-private-key"
                value={importValue}
                onChange={(event) => setImportValue(event.target.value)}
                placeholder="0x..."
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
                aria-invalid={importValue.length > 0 && !validImportPrivateKey}
                data-testid="input-import-session-key"
              />
              <Button
                type="button"
                size="sm"
                disabled={!owner || !validImportPrivateKey || isLoading}
                onClick={() => {
                  if (!validImportPrivateKey) return;
                  void importPrivateKey(validImportPrivateKey).then(() => setImportValue(""));
                }}
                data-testid="button-import-session-key"
              >
                {isLoading && validImportPrivateKey ? (
                  <>
                    <Spinner className="size-4" /> Importing...
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            </div>
          </div>

          <div className="border-border/70 bg-muted/20 space-y-3 rounded-xl border p-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="session-key-sign-message" className="text-sm font-medium">
                Sign message
              </label>
              <p className="text-muted-foreground text-xs">Sign a plain text message with the loaded session key.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="session-key-sign-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Message to sign"
                data-testid="input-session-key-sign-message"
              />
              <Button
                type="button"
                size="sm"
                disabled={!isReady || message.trim().length === 0 || isSigning}
                onClick={() => {
                  const nextMessage = message.trim();
                  if (!nextMessage) return;
                  void signMessage(nextMessage).then((result) =>
                    setSignResult({
                      message: nextMessage,
                      signature: result.signature,
                      sessionKeyAddress: result.sessionKeyAddress,
                      durationMs: result.durationMs,
                    }),
                  );
                }}
                data-testid="button-sign-session-key-message"
              >
                {isSigning ? (
                  <>
                    <Spinner className="size-4" /> Signing...
                  </>
                ) : (
                  "Sign"
                )}
              </Button>
            </div>

            {signResult ? (
              <DataList data-testid="result-session-key-signature">
                <DataRow label="message" value={signResult.message} copyValue={signResult.message} />
                <DataRow label="signer" value={<AddressTag address={signResult.sessionKeyAddress} />} />
                <DataRow label="signature" value={signResult.signature} copyValue={signResult.signature} mono />
                <DataRow label="duration" value={`${signResult.durationMs.toFixed(2)}ms`} mono />
              </DataList>
            ) : null}
          </div>

          {error ? (
            <ResultError testId="result-localSessionKey-error" message={error.message} />
          ) : (
            <ResultNote testId="result-localSessionKey-note">
              Delegate this session key address in `grantDelegation` before using it to sign Instant Layer operations.
            </ResultNote>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function parsePrivateKey(value: string): Hex | undefined {
  const trimmed = value.trim();
  if (!isHex(trimmed) || trimmed.length !== 66) return undefined;
  return trimmed;
}

function formatExpiry(expiresAtMs: number): string {
  const timestampSeconds = BigInt(Math.floor(expiresAtMs / 1000));
  return formatRelativeTimestamp(timestampSeconds, {
    formatFuture: (duration) => `expires in ${duration}`,
    formatPast: (duration) => `expired ${duration} ago`,
  });
}
