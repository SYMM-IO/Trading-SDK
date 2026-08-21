"use client";

import { Panel, PanelHeader } from "@/components/panel";
import { Segmented } from "@/components/segmented";
import { useState } from "react";
import { CodeBlock } from "./code-block";
import { INTEGRATION_FILES } from "./integration-code";

const OPTIONS = INTEGRATION_FILES.map((file) => ({
  value: file.path,
  label: file.path.split("/").pop() ?? file.path,
}));

/**
 * The entire SYMMIO wiring of this app, in three files.
 *
 * Shown with the real paths and a copy button so the claim is checkable: open
 * the file, diff it, and the only differences should be the doc comments the
 * excerpts mark as elided. A walkthrough that cannot be checked is a poster.
 */
export function IntegrationPanel() {
  const [path, setPath] = useState(INTEGRATION_FILES[0]?.path ?? "");
  const file = INTEGRATION_FILES.find((entry) => entry.path === path) ?? INTEGRATION_FILES[0];

  if (!file) return null;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Three files, no adapters"
        title="That’s the whole integration"
        actions={<Segmented options={OPTIONS} value={path} onChange={setPath} size="sm" />}
      />

      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm leading-relaxed text-fg-2">{file.role}</p>
        <CodeBlock code={file.code} file={file.path} caption={`${file.code.trimEnd().split("\n").length} lines`} />
        <p className="text-2xs leading-relaxed text-fg-3">
          Copied out of the repository. Doc comments are elided and every elision is marked inline, so the excerpt diffs
          cleanly against the file it names.
        </p>
      </div>
    </Panel>
  );
}
