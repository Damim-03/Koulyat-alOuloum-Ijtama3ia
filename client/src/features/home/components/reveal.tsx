import type { ReactNode } from "react";
import { useReveal } from "../../../hooks/use-reveal";

interface Props {
  children: ReactNode;
  /** تأخير الظهور بالمللي-ثانية (للتدرّج بين عناصر متتابعة) */
  delay?: number;
  /** أصناف إضافية تُمرَّر للغلاف (مثل h-full داخل شبكة) */
  className?: string;
}

/**
 * Wraps content and fades/slides it up the first time it scrolls into view.
 * Reusable across the homepage sections.
 */
export function Reveal({ children, delay = 0, className = "" }: Props) {
  const { ref, visible } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
