import { useInput } from "ink";
import { useEffect, useState } from "react";
import { useAppState } from "./app-state.js";

/**
 * Row-based keyboard navigation for a form or action list. Up/Down always move
 * between rows with wrap-around; `j`/`k` do so only outside text rows, where
 * printable characters belong to the input. The global text-editing flag keeps
 * all other single-key shortcuts suspended while a text row is focused. Active
 * only when `active` — so a form and the tab rail never fight over a keystroke.
 */
export function useFormNav(rowCount: number, active: boolean, isTextRow?: (row: number) => boolean) {
  const { setTextEditing } = useAppState();
  const [row, setRow] = useState(0);

  useInput(
    (input, key) => {
      if (rowCount <= 0) return;
      const textRow = Boolean(isTextRow?.(row));
      if (key.downArrow || (!textRow && input === "j")) setRow((current) => (current + 1) % rowCount);
      else if (key.upArrow || (!textRow && input === "k")) setRow((current) => (current - 1 + rowCount) % rowCount);
    },
    { isActive: active },
  );

  useEffect(() => {
    const editing = active && Boolean(isTextRow?.(row));
    setTextEditing(editing);
    return () => setTextEditing(false);
    // isTextRow is a fresh closure each render but cheap to re-run.
  }, [row, active, setTextEditing, isTextRow]);

  return { row, setRow };
}
