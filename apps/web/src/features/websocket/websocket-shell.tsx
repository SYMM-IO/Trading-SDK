import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { NotificationsConsole } from "./notifications-console";

/**
 * WebSockets page: live, real-time SDK streams. Each channel is its own
 * `MethodGroup` section — Notifications today; price and TP/SL land here next.
 */
export function WebsocketShell() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · WebSockets"
        title="WebSockets"
        description="Subscribe to the chain's live WebSocket channels and watch events stream in real time. Notifications stream position and quote state today; more channels land here next."
      />
      <MethodGroup label="Notifications" count={1} fullWidth>
        <NotificationsConsole />
      </MethodGroup>
    </section>
  );
}
