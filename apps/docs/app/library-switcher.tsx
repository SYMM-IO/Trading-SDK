"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * The SDK libraries the switcher scopes between, in sidebar order. `key`
 * matches the top-level `app/<key>` route so selecting one navigates to that
 * library's Overview and drives the `data-doc-lib` scoping in `globals.css`.
 */
const LIBRARIES = [
  { key: "core", label: "Core", pkg: "@symmio/trading-core" },
  { key: "react", label: "React", pkg: "@symmio/trading-react" },
  { key: "utils", label: "Utils", pkg: "@symmio/utils" },
  { key: "session-key", label: "Session Key", pkg: "@symmio/session-key" },
] as const;

type LibraryKey = (typeof LIBRARIES)[number]["key"];

const LIBRARY_KEYS = LIBRARIES.map((library) => library.key) as LibraryKey[];

/** Library shown on shared pages (Introduction, Guides). */
const DEFAULT_LIBRARY: LibraryKey = "core";

/** Persists the last-picked library so shared pages keep it in view. */
const STORAGE_KEY = "symmio-docs-library";

/** Nextra renders a separate menu for desktop and mobile; scope both. */
const SIDEBAR_SELECTORS = [".nextra-sidebar", ".nextra-mobile-nav"];

/** Class marking the DOM node we inject at the top of each sidebar. */
const SLOT_CLASS = "symm-lib-switcher-slot";

function isLibraryKey(value: string | undefined): value is LibraryKey {
  return value !== undefined && LIBRARY_KEYS.includes(value as LibraryKey);
}

/**
 * A "command field" pinned to the top of the docs sidebar. Picking a library
 * navigates to it and scopes the sidebar to that library's pages (including its
 * own Getting Started), while Introduction and Guides stay visible for every
 * library.
 *
 * The Nextra sidebar exposes no slot for custom content, so this renders via a
 * portal into the theme's `.nextra-sidebar` / `.nextra-mobile-nav` elements and
 * scopes the tree with a `data-doc-lib` attribute on `<html>` (see the matching
 * rules in `app/globals.css`).
 */
export function LibrarySwitcher() {
  const pathname = usePathname();
  const router = useRouter();

  const segment = (pathname ?? "").split("/").filter(Boolean)[0];
  const routeLibrary = isLibraryKey(segment) ? segment : null;

  /**
   * Last library the reader landed on — the fallback used on shared pages
   * (Introduction, Guides). Seeded from the current route, then
   * storage, during the initial render so the scoped library never flips after
   * mount (the component renders nothing until its slots attach, so this
   * client-only seed can't cause a hydration mismatch).
   */
  const [remembered, setRemembered] = useState<LibraryKey>(() => {
    if (routeLibrary) return routeLibrary;
    if (typeof window === "undefined") return DEFAULT_LIBRARY;
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isLibraryKey(value ?? undefined) ? (value as LibraryKey) : DEFAULT_LIBRARY;
  });
  /**
   * The just-picked library, held only until the route catches up. Client
   * navigation between two library pages leaves `routeLibrary` on the old value
   * for a frame, so this keeps the label and scoping in step with the pick.
   */
  const [pending, setPending] = useState<LibraryKey | null>(null);
  const [slots, setSlots] = useState<HTMLElement[]>([]);

  /** The library the sidebar is currently scoped to. */
  const active = pending ?? routeLibrary ?? remembered;

  /** Landing on a library page (link or direct URL) syncs the fallback. */
  useEffect(() => {
    if (routeLibrary) setRemembered(routeLibrary);
    if (pending && routeLibrary === pending) setPending(null);
  }, [routeLibrary, pending]);

  /** Persist and scope whenever the active library changes. */
  useEffect(() => {
    document.documentElement.setAttribute("data-doc-lib", active);
    window.localStorage.setItem(STORAGE_KEY, active);
  }, [active]);

  /**
   * Inject — and keep — a mount node at the top of each sidebar variant. Nextra
   * replaces the sidebar `<aside>` when navigating between top-level sections,
   * which drops our slot, so a MutationObserver re-attaches it whenever the
   * sidebar is (re)mounted.
   */
  useEffect(() => {
    const created = new Set<HTMLElement>();
    let frame = 0;

    function ensure() {
      const mounts: HTMLElement[] = [];
      for (const selector of SIDEBAR_SELECTORS) {
        const container = document.querySelector<HTMLElement>(selector);
        if (!container) continue;
        let slot = container.querySelector<HTMLElement>(`:scope > .${SLOT_CLASS}`);
        if (!slot) {
          slot = document.createElement("div");
          slot.className = SLOT_CLASS;
          container.prepend(slot);
          created.add(slot);
        }
        mounts.push(slot);
      }
      setSlots((prev) =>
        prev.length === mounts.length && prev.every((node, i) => node === mounts[i]) ? prev : mounts,
      );
    }

    ensure();
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(ensure);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      for (const slot of created) slot.remove();
    };
  }, []);

  const handleSelect = useCallback(
    (key: LibraryKey) => {
      setPending(key);
      setRemembered(key);
      document.documentElement.setAttribute("data-doc-lib", key);
      window.localStorage.setItem(STORAGE_KEY, key);
      router.push(`/${key}`);
    },
    [router],
  );

  if (!slots.length) return null;

  return (
    <>
      {slots.map((slot, index) =>
        createPortal(<Switcher active={active} onSelect={handleSelect} />, slot, `switcher-${index}`),
      )}
    </>
  );
}

interface Props {
  active: LibraryKey;
  onSelect: (key: LibraryKey) => void;
}

function Switcher(props: Props) {
  const { active, onSelect } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeLibrary = LIBRARIES.find((library) => library.key === active) ?? LIBRARIES[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={open ? "symm-lib-switcher open" : "symm-lib-switcher"} ref={rootRef}>
      <button
        type="button"
        className="symm-lib-switcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="symm-lib-switcher__glyph" aria-hidden>
          <LibraryGlyph library={active} />
        </span>
        <span className="symm-lib-switcher__label">
          <span className="symm-lib-switcher__eyebrow">Library</span>
          <span className="symm-lib-switcher__current">{activeLibrary.label}</span>
        </span>
        <span className="symm-lib-switcher__chevron" aria-hidden>
          <ChevronDown />
        </span>
      </button>
      <ul className="symm-lib-switcher__menu" role="listbox" aria-label="Select a library">
        {LIBRARIES.map((library) => {
          const selected = library.key === active;
          return (
            <li key={library.key}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className="symm-lib-switcher__option"
                onClick={() => {
                  onSelect(library.key);
                  setOpen(false);
                }}
              >
                <span className="symm-lib-switcher__oglyph" aria-hidden>
                  <LibraryGlyph library={library.key} />
                </span>
                <span className="symm-lib-switcher__otext">
                  <span className="symm-lib-switcher__otitle">{library.label}</span>
                  <span className="symm-lib-switcher__opkg">{library.pkg}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LibraryGlyph({ library }: { library: LibraryKey }): ReactNode {
  switch (library) {
    case "react":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <circle cx="12" cy="12" r="2" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)" />
          <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)" />
        </svg>
      );
    case "utils":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-.4-.4-2.1z" />
        </svg>
      );
    case "session-key":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="15" r="4" />
          <path d="M10.8 12.2 20 3M17 6l2 2M14 9l2 2" />
        </svg>
      );
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2 21 7v10l-9 5-9-5V7z" />
          <path d="M12 22V12M12 12l9-5M12 12 3 7" />
        </svg>
      );
  }
}

function ChevronDown(): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
