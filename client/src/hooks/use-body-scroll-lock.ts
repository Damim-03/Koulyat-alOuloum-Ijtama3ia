import { useEffect } from "react";

/**
 * Freezes the page behind an open overlay.
 *
 * Without this the wheel keeps scrolling the page under a modal, which reads
 * as the dialog drifting. Hiding the scrollbar also reflows the layout, so the
 * width it occupied is added back as padding — on the side it actually sits,
 * which flips with the document direction (RTL puts it on the left).
 *
 * A counter is kept so stacked overlays (a cropper opened over a form dialog)
 * only release the lock when the last one closes.
 */
let lockCount = 0;
let previous = { overflow: "", paddingLeft: "", paddingRight: "" };

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const body = document.body;

    if (lockCount === 0) {
      const gap = window.innerWidth - document.documentElement.clientWidth;
      const rtl =
        getComputedStyle(document.documentElement).direction === "rtl";

      previous = {
        overflow: body.style.overflow,
        paddingLeft: body.style.paddingLeft,
        paddingRight: body.style.paddingRight,
      };

      body.style.overflow = "hidden";
      if (gap > 0) {
        if (rtl) body.style.paddingLeft = `${gap}px`;
        else body.style.paddingRight = `${gap}px`;
      }
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        body.style.overflow = previous.overflow;
        body.style.paddingLeft = previous.paddingLeft;
        body.style.paddingRight = previous.paddingRight;
      }
    };
  }, [active]);
}
