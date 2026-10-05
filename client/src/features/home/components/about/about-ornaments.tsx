import { useId, type ReactNode } from "react";
import { Reveal } from "../reveal";

/**
 * زخارف صفحة «عن المنصة»: فاصلٌ ذهبيّ بمعيّن، ونقشٌ هندسيّ خافت، ورأسُ قسم.
 * كلّها بألوان العلامة (الذهبيّ والأخضر)، فتصلح للوضعين الفاتح والداكن.
 */

/** خطّان ذهبيّان يتلاشيان، بينهما معيّنٌ ونقطتان — فاصلٌ تحت العناوين. */
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`flex items-center justify-center gap-2 ${className}`}>
      <span className="h-px w-14 bg-linear-to-l from-gold to-transparent" />
      <span className="size-1 rounded-full bg-gold/60" />
      <span className="size-2.5 rotate-45 border border-gold bg-gold/30" />
      <span className="size-1 rounded-full bg-gold/60" />
      <span className="h-px w-14 bg-linear-to-r from-gold to-transparent" />
    </span>
  );
}

/**
 * نجمةٌ ثمانية — مربّعان متراكبان — تتكرّر نقشاً خافتاً على الأقسام الداكنة.
 * و`useId` يفرد معرّف النقش، فلا يتصادم نقشان في صفحةٍ واحدة.
 */
export function StarPattern({ className = "" }: { className?: string }) {
  const id = `stars-${useId().replace(/:/g, "")}`;
  return (
    <svg aria-hidden="true" className={`pointer-events-none absolute inset-0 size-full ${className}`}>
      <defs>
        <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="0.8">
            <rect x="20" y="20" width="24" height="24" />
            <rect x="20" y="20" width="24" height="24" transform="rotate(45 32 32)" />
            <circle cx="32" cy="32" r="4" />
          </g>
          <circle cx="0" cy="0" r="1.2" fill="currentColor" />
          <circle cx="64" cy="64" r="1.2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** رأس قسم: عنوانٌ صغيرٌ ذهبيّ، ثمّ العنوان، ثمّ الفاصل المزخرف. */
export function SectionHeading({
  eyebrow,
  title,
  onDark = false,
  children,
}: {
  eyebrow: string;
  title: string;
  onDark?: boolean;
  children?: ReactNode;
}) {
  return (
    <Reveal className="mx-auto mb-14 max-w-2xl text-center">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h2
        dir="auto"
        className={`font-serif text-3xl font-bold leading-snug md:text-[2.6rem] ${onDark ? "text-cream" : "text-forest"}`}
      >
        {title}
      </h2>
      <Ornament className="mt-5" />
      {children}
    </Reveal>
  );
}
