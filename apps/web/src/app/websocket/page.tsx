import { WebsocketShell } from "@/features/websocket/websocket-shell";

export const metadata = {
  title: "WebSockets · Symmio",
  description: "Subscribe to the SDK's live WebSocket channels and watch position/quote events stream in.",
};

export default function WebsocketPage() {
  return <WebsocketShell />;
}
