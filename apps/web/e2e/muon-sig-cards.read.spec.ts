import { expect, test } from "@playwright/test";

/**
 * Read-only smoke of the two contract-ready Muon signature cards.
 *
 * Both are plain HTTP reads against the live Muon gateway — no wallet, no
 * session key, no on-chain write — so they are safe to drive in CI-less local
 * verification. `partyA` is a synthetic address: the gateway still returns a
 * well-formed attestation, which is all this asserts.
 */
const SYNTHETIC_PARTY_A = "0x0000000000000000000000000000000000000001";

test("getSendQuoteUpnlSig card assembles a live SingleUpnlAndPriceSig", async ({ page }) => {
  await page.goto("/muon");

  const card = page.getByTestId("muon-send-quote-upnl-sig");
  await expect(card).toBeVisible();

  await card.getByTestId("muon-send-quote-upnl-sig-party-a-account").fill(SYNTHETIC_PARTY_A);
  await card.getByTestId("input-muon-send-quote-upnl-sig-symbol-id").fill("1");
  await card.getByTestId("button-fetch-muon-send-quote-upnl-sig").click();

  /** The panel's testid carries its state suffix (`-idle` / `-error` / `-data`). */
  const result = card.locator('[data-testid^="result-muon-send-quote-upnl-sig-data"]');
  /** The gateway round-trip is the slow part; give it room. */
  await expect(result).toContainText("reqId", { timeout: 45_000 });

  /** Every field of the contract tuple must be present, in the struct's own names. */
  for (const field of ["reqId", "timestamp", "upnl", "price", "gatewaySignature", "sigs"]) {
    await expect(result).toContainText(field);
  }
});

test("getForceClosePriceSig card surfaces the gateway's window validation", async ({ page }) => {
  await page.goto("/muon");

  const card = page.getByTestId("muon-force-close-price-sig");
  await expect(card).toBeVisible();

  const now = Math.floor(Date.now() / 1000);
  await card.getByTestId("muon-force-close-price-sig-t0-field").fill(String(now - 3600));
  await card.getByTestId("muon-force-close-price-sig-t1-field").fill(String(now));
  await card.getByTestId("muon-force-close-price-sig-party-a-account").fill(SYNTHETIC_PARTY_A);
  await card.getByTestId("input-muon-force-close-price-sig-party-b").fill("0x81631953E0C093e72935C1CAA4C7D519B2A0E407");
  await card.getByTestId("input-muon-force-close-price-sig-symbol-id").fill("1");
  await card.getByTestId("button-fetch-muon-force-close-price-sig").click();

  /**
   * A synthetic partyA owns no position, and the gateway validates the window
   * against the position's lifetime — so the honest expectation here is a
   * surfaced error, not an attestation. Verifying a real `HighLowPriceSig`
   * needs an account with an open position.
   */
  const result = card.locator(
    '[data-testid="result-muon-force-close-price-sig-error"], [data-testid="result-muon-force-close-price-sig-data"]',
  );
  await expect(result).toBeVisible({ timeout: 45_000 });
});
