import { SessionKeysPanel } from "@/features/session-keys/session-keys-panel";

export const metadata = {
  title: "Session Keys · Symmio",
  description: "Create and manage a browser-local signing key for delegated SYMMIO flows.",
};

export default function SessionKeysPage() {
  return <SessionKeysPanel />;
}
