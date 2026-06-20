"use client";

/**
 * Mirrors the host document's chrome into an external (popped-out) window so
 * React content rendered there looks identical to the main app.
 *
 * A separate window has its own `document`, so the compiled Tailwind stylesheets,
 * the next/font variable classes, and the `.dark` theme class all have to be
 * copied across — and kept in sync while the window stays open (dev HMR injects
 * new style nodes; next-themes toggles the root class on theme changes).
 *
 * @param target - The opened window to mirror styles into.
 * @returns A cleanup function that disconnects the observers.
 *
 * @example
 * const win = window.open("", "popout", "popup=yes");
 * const stop = syncWindowChrome(win!);
 * // ...later, when the window closes:
 * stop();
 */
export function syncWindowChrome(target: Window): () => void {
  const srcHead = document.head;
  const dstHead = target.document.head;

  /** Clone a stylesheet node (compiled CSS `<style>` in dev, `<link>` in prod). */
  const cloneStyleNode = (node: Node) => {
    if (node instanceof HTMLStyleElement || (node instanceof HTMLLinkElement && node.rel === "stylesheet")) {
      dstHead.appendChild(node.cloneNode(true));
    }
  };
  srcHead.querySelectorAll('style, link[rel="stylesheet"]').forEach(cloneStyleNode);

  /** Carry the root classes (next/font variables + theme) and the color-scheme style. */
  const mirrorRoot = () => {
    target.document.documentElement.className = document.documentElement.className;
    const style = document.documentElement.getAttribute("style");
    if (style) target.document.documentElement.setAttribute("style", style);
    else target.document.documentElement.removeAttribute("style");
  };
  mirrorRoot();

  /** Keep the theme live: next-themes flips `.dark`/color-scheme on `<html>`. */
  const rootObserver = new MutationObserver(mirrorRoot);
  rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

  /** Mirror stylesheets added after open (dev HMR, lazily-loaded fonts). */
  const headObserver = new MutationObserver((records) => {
    for (const record of records) record.addedNodes.forEach(cloneStyleNode);
  });
  headObserver.observe(srcHead, { childList: true });

  return () => {
    rootObserver.disconnect();
    headObserver.disconnect();
  };
}
