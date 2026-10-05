import { useEffect, useRef, useState } from "react";

const DURATION_MS = 1600;

/** «+2000» ⇐ ["+", 2000, ""]؛ و«100%» ⇐ ["", 100, "%"]. وما لا رقم فيه يُعرض كما هو. */
function parse(value: string) {
  const m = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const raw = m[2];
  return {
    prefix: m[1],
    target: Number(raw.replace(/,/g, "")),
    suffix: m[3],
    decimals: raw.includes(".") ? raw.split(".")[1].length : 0,
    grouped: raw.includes(","),
  };
}

const reducedMotion = () =>
  typeof window === "undefined" ||
  !("IntersectionObserver" in window) ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * رقمٌ يعدّ من الصفر إلى قيمته أوّلَ ما يبلغه النظر — والرموز حوله (+، %) ثابتة.
 *
 * لمن طلب تقليل الحركة، أو في متصفّحٍ لا يرصد الظهور، يُعرض الرقم كاملاً من
 * البداية: رقمٌ عالقٌ على الصفر أسوأ من رقمٍ لا يتحرّك.
 */
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const parsed = parse(value);
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState<number | null>(() =>
    parsed && !reducedMotion() ? 0 : null,
  );
  const target = parsed?.target;

  useEffect(() => {
    if (target === undefined || reducedMotion() || !ref.current) return;
    let frame = 0;
    const ob = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        ob.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / DURATION_MS);
          const eased = 1 - Math.pow(1 - p, 3);
          setCurrent(p >= 1 ? null : target * eased);
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    ob.observe(ref.current);
    return () => {
      ob.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target]);

  if (!parsed || current === null)
    return (
      <span ref={ref} dir="ltr" className={className}>
        {value}
      </span>
    );

  const n = current.toFixed(parsed.decimals);
  const shown = parsed.grouped ? Number(n).toLocaleString("en-US") : n;
  return (
    <span ref={ref} dir="ltr" className={`tabular-nums ${className}`}>
      {parsed.prefix}
      {shown}
      {parsed.suffix}
    </span>
  );
}
