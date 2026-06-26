import { PageHeader } from "@/components/page-header";
import { MethodGroup } from "../inspector/method-group";
import { NotificationSearchCard } from "./notification-search-card";
import { NotificationsConsole } from "./notifications-console";

/**
 * WebSockets page: the live notifications stream plus its REST counterpart —
 * search stored notification history. Each capability is its own `MethodGroup`
 * section; price and TP/SL streams land here next.
 */
export function WebsocketShell() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <PageHeader
        eyebrow="React SDK · WebSockets"
        title="WebSockets"
        description="Subscribe to the chain's live WebSocket channels and watch events stream in real time. Notifications stream position and quote state live; search their stored history below."
      />
      <MethodGroup label="Live notifications" count={1} fullWidth>
        <NotificationsConsole />
      </MethodGroup>
      <MethodGroup label="Search history" count={1} fullWidth>
        <NotificationSearchCard />
      </MethodGroup>
    </section>
  );
}
