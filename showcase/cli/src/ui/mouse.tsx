import type { DOMElement } from "ink";
import { useMouse, type MouseState } from "ink-use-mouse";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

const MouseContext = createContext<MouseState | null>(null);

/** Owns the app's single terminal mouse listener. */
export function MouseProvider({ children }: { children: ReactNode }) {
  const mouse = useMouse();
  return <MouseContext.Provider value={mouse}>{children}</MouseContext.Provider>;
}

interface MouseRegion {
  ref: RefObject<DOMElement | null>;
  hovered: boolean;
}

interface Bounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Makes an Ink box react to a left click without adding another stdin listener. */
export function useMouseRegion(onClick: () => void, disabled = false): MouseRegion {
  const mouse = useContext(MouseContext);
  const ref = useRef<DOMElement | null>(null);
  const callbackRef = useRef(onClick);
  const handledPressRef = useRef<MouseState | null>(null);
  const [hovered, setHovered] = useState(false);

  callbackRef.current = onClick;

  useEffect(() => {
    if (!mouse || disabled || !mouse.isActive) {
      setHovered(false);
      return;
    }

    const bounds = getAbsoluteBounds(ref.current);
    const nextHovered = bounds != null && contains(bounds, mouse.x, mouse.y);
    setHovered(nextHovered);

    if (nextHovered && mouse.type === "press" && mouse.button === "left" && handledPressRef.current !== mouse) {
      handledPressRef.current = mouse;
      callbackRef.current();
    }
  }, [disabled, mouse]);

  return { ref, hovered };
}

function contains(bounds: Bounds, x: number, y: number): boolean {
  return x >= bounds.left && x < bounds.left + bounds.width && y >= bounds.top && y < bounds.top + bounds.height;
}

function getAbsoluteBounds(node: DOMElement | null): Bounds | null {
  const yoga = node?.yogaNode;
  if (!yoga) return null;

  let left = 0;
  let top = 0;
  let current: typeof yoga | null = yoga;
  while (current) {
    left += current.getComputedLeft();
    top += current.getComputedTop();
    current = current.getParent();
  }

  return {
    left,
    top,
    width: yoga.getComputedWidth(),
    height: yoga.getComputedHeight(),
  };
}
