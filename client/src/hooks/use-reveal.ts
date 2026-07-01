import { useEffect, useRef, useState } from "react";

interface RevealOptions {
  /** كم نسبة العنصر يجب أن تظهر قبل التشغيل (0–1) */
  threshold?: number;
  /** يشغّل الأنيميشن مرّة واحدة فقط (افتراضي) أو في كل دخول/خروج */
  once?: boolean;
  /** هامش الجذر — السالب يؤخّر التشغيل حتى يدخل العنصر أكثر */
  rootMargin?: string;
}

/**
 * Reveal-on-scroll hook. Returns a ref to attach to an element and a
 * `visible` flag that flips true the first time the element scrolls into view.
 * Respects prefers-reduced-motion (shows immediately, no animation).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: RevealOptions,
) {
  const {
    threshold = 0.15,
    once = true,
    rootMargin = "0px 0px -10% 0px",
  } = options ?? {};

  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Accessibility: skip the animation for users who prefer reduced motion.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) ob.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold, once, rootMargin]);

  return { ref, visible } as const;
}
