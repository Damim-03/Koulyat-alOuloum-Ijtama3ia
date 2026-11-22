import { useEffect, useRef } from "react";

/**
 * Escape closes the overlay on top — and only it.
 *
 * Overlays stack: a file picker opened from the compose window, a PDF opened
 * from a chat. Each one that is open joins a stack; Escape goes to the last,
 * and is stopped on the window in the capture phase so that a dialog below
 * listening on the document (the compose window does) does not close too.
 */
const stack: { current: () => void }[] = [];

function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape" || stack.length === 0) return;
  e.stopPropagation();
  stack[stack.length - 1]!.current();
}

export function useEscapeToClose(onClose: () => void, active = true) {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const entry = latest;
    if (stack.length === 0) window.addEventListener("keydown", onKey, true);
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      if (stack.length === 0) window.removeEventListener("keydown", onKey, true);
    };
  }, [active]);
}
