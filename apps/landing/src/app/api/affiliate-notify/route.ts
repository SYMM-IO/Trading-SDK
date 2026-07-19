import type { NotificationPayload } from "@/features/affiliate/registration-utils";
import { formatAffiliateNotification } from "@/features/affiliate/telegram-message";

/**
 * Notify endpoint for affiliate registrations. The client
 * (`src/features/affiliate/use-registration-form.ts`) posts a
 * {@link NotificationPayload} here as soon as the on-chain
 * `requestToRegisterAffiliate` transaction is mined, and this route forwards a
 * formatted summary to the team's Telegram channel via the Bot API.
 *
 * Server-only: it reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from the
 * environment so the bot token never ships to the browser. This first version
 * trusts the client's confirmed transaction and does no on-chain verification
 * beyond dropping the anti-spam honeypot; add verification or dedup later if the
 * endpoint is ever abused.
 */
export async function POST(request: Request): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return Response.json({ error: "Telegram notifications are not configured." }, { status: 500 });
  }

  let payload: NotificationPayload;
  try {
    payload = (await request.json()) as NotificationPayload;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  /**
   * Anti-spam honeypot: a genuine submission leaves this empty. Accept with 200
   * so an automated poster gets no failure signal, but never forward the message.
   */
  if ((payload.honeypot ?? "").trim() !== "") {
    return Response.json({ ok: true });
  }

  if (!payload.name || !payload.registrant || !payload.txHash) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatAffiliateNotification(payload),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return Response.json({ error: "Telegram rejected the message.", detail }, { status: 502 });
    }
  } catch {
    return Response.json({ error: "Could not reach Telegram." }, { status: 502 });
  }

  return Response.json({ ok: true });
}
