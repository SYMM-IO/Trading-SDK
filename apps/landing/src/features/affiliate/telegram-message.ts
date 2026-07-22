import { hyperEvm } from "viem/chains";
import { truncateAddress, type NotificationPayload } from "./registration-utils";

/**
 * Escape the three characters Telegram's HTML parse mode treats as markup, so a
 * user-supplied value (affiliate name, domain, email, brand color, metadata) can
 * never break the message layout or inject tags.
 */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Block-explorer transaction URL for a chain we recognise, or `undefined` when we
 * have no explorer for it (the message then shows the bare hash).
 */
function explorerTxUrl(chainId: number, txHash: string): string | undefined {
  if (chainId !== hyperEvm.id) return undefined;
  const base = hyperEvm.blockExplorers?.default.url;
  return base ? `${base}/tx/${txHash}` : undefined;
}

/**
 * Render a {@link NotificationPayload} into the HTML message body posted to the
 * team's Telegram channel. Uses Telegram's HTML parse mode: `<b>` labels,
 * `<code>` for addresses and hashes, and an `<a>` link to the transaction on the
 * block explorer. Every free-form field is HTML-escaped.
 *
 * @param payload - The off-chain + on-chain summary captured at registration.
 * @returns The message text to pass to the Bot API `sendMessage` call.
 */
export function formatAffiliateNotification(payload: NotificationPayload): string {
  const lines: string[] = ["🤝 <b>New affiliate registration</b>", ""];

  lines.push(`<b>Name:</b> ${escapeHtml(payload.name)}`);
  lines.push(`<b>Domain:</b> ${escapeHtml(payload.domain)}`);
  if (payload.email) lines.push(`<b>Email:</b> ${escapeHtml(payload.email)}`);
  if (payload.brandColor) lines.push(`<b>Brand color:</b> <code>${escapeHtml(payload.brandColor)}</code>`);

  lines.push("");
  if (payload.affiliate) lines.push(`<b>Affiliate:</b> <code>${payload.affiliate}</code>`);
  lines.push(`<b>Registrant:</b> <code>${payload.registrant}</code>`);
  lines.push(`<b>Admin:</b> <code>${payload.admin}</code>`);

  lines.push("", "<b>Fee split</b>");
  for (const stakeholder of payload.stakeholders) {
    lines.push(`• <code>${truncateAddress(stakeholder.receiver, 6)}</code> — ${escapeHtml(stakeholder.percent)}%`);
  }
  lines.push(`• SYMMIO — ${escapeHtml(payload.symmioPercent)}%`);

  if (payload.symmioCores.length > 0) {
    lines.push("", "<b>Symmio cores</b>");
    for (const core of payload.symmioCores) {
      lines.push(`• <code>${truncateAddress(core, 6)}</code>`);
    }
  }

  if (payload.legacyMultiAccounts.length > 0) {
    lines.push("", "<b>Legacy multi-accounts</b>");
    for (const account of payload.legacyMultiAccounts) {
      lines.push(`• <code>${truncateAddress(account, 6)}</code>`);
    }
  }

  if (payload.metadata) lines.push("", `<b>Metadata:</b> ${escapeHtml(payload.metadata)}`);

  lines.push("");
  const url = explorerTxUrl(payload.chainId, payload.txHash);
  lines.push(
    url
      ? `<b>Tx:</b> <a href="${url}">${truncateAddress(payload.txHash, 8)} ↗</a>`
      : `<b>Tx:</b> <code>${payload.txHash}</code>`,
  );

  return lines.join("\n");
}
