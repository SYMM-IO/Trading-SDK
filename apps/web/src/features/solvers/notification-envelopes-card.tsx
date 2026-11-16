"use client";

import { ResultError, ResultNote } from "@/components/result";
import { useNotificationEnvelopes } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@symmio/ui/components/card";
import { Input } from "@symmio/ui/components/input";
import { Label } from "@symmio/ui/components/label";
import { useState } from "react";
import type { Address } from "viem";
import { SubAccountPicker } from "../inspector/subaccount-picker";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

/** Inspect complete Enigma documents without application query invalidation. */
export function NotificationEnvelopesCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "enigma" });
  const [selection, setSelection] = useState<{ subAccount?: Address; name?: string }>({});
  const [channel, setChannel] = useState("");
  const [subscription, setSubscription] = useState<{ account: Address; channel: string }>();
  const [frames, setFrames] = useState<string[]>([]);
  const { status, error } = useNotificationEnvelopes({
    chainId: target.chainId,
    solverId: target.solverId,
    subscriptions: subscription ? [subscription] : [],
    onEnvelope: (envelope) => setFrames((previous) => [JSON.stringify(envelope, null, 2), ...previous].slice(0, 50)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Full notification envelopes</CardTitle>
        <CardDescription>
          Inspect one Enigma account/channel subscription, including server metadata. Status: {status}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SolverTargetSelect value={target} onChange={setTarget} requireKind="enigma" testId="envelope-solver" />
        <SubAccountPicker idPrefix="envelope-console" selected={selection} onSelect={setSelection} />
        <Label htmlFor="envelope-channel">Notification channel</Label>
        <Input id="envelope-channel" value={channel} onChange={(event) => setChannel(event.target.value)} />
        <div className="flex gap-2">
          <Button
            type="button"
            disabled={!selection.subAccount || !channel.trim()}
            onClick={() => {
              if (!selection.subAccount) return;
              setFrames([]);
              setSubscription({ account: selection.subAccount, channel: channel.trim() });
            }}
          >
            Subscribe
          </Button>
          <Button type="button" variant="outline" disabled={!subscription} onClick={() => setSubscription(undefined)}>
            Unsubscribe
          </Button>
          <Button type="button" variant="outline" disabled={!frames.length} onClick={() => setFrames([])}>
            Clear
          </Button>
        </div>
        {error ? <ResultError kind={error.kind} message={error.message} /> : null}
        {frames.length ? (
          <pre className="max-h-96 overflow-auto text-xs">{frames.join("\n\n")}</pre>
        ) : (
          <ResultNote>No envelopes received.</ResultNote>
        )}
      </CardContent>
    </Card>
  );
}
