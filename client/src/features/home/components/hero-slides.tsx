import { useEffect, useState } from "react";
import { assetUrl } from "../../../lib/asset-url";
import type { PublicHomeSlide } from "../../../types/site.types";
import { SlideControls } from "./slide-controls";

/** مدّة بقاء الصورة قبل أن تخلفها التالية. */
const INTERVAL_MS = 6500;

/**
 * التعتيم فوق الصور: من لون العلامة نفسه، لا أسودَ عامّاً، فتبقى الواجهة
 * خضراء الطابع أيّاً كانت الصورة — ويُقرأ العنوان الكريميّ فوق أيّ صورة.
 *
 * و`--t-brand-deep` لا `forest-deep`: هذا الأخير ينقلب فاتحاً في الوضع
 * الداكن، وصنف `bg-forest-deep/75` لا تطاله تصحيحات `index.css`، فكانت
 * الصور ستُغطّى بضبابٍ أبيض.
 */
const SCRIM = {
  background:
    "linear-gradient(to top, var(--t-brand-deep) 0%, color-mix(in srgb, var(--t-brand-deep) 78%, transparent) 38%, color-mix(in srgb, var(--t-brand-deep) 58%, transparent) 100%)",
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * صورُ الإدارة تتعاقب خلف عنوان الصفحة الرئيسية.
 *
 * تُرسم خلفيةً لا محتوى: العنوان والأزرار باقيةٌ كما هي فوقها، فلا يتبدّل ما
 * يُقرأ مع كلّ صورة. والصور زخرفيّة (`alt=""`)، والسطر المرافق لها يُقرأ
 * نصّاً في الزاوية.
 *
 * والحركة لا تُفرض: تتوقّف ما دام المؤشّر أو التركيز على أزرارها، ولها زرّ
 * إيقاف، ولا تبدأ أصلاً لمن طلب من نظامه تقليل الحركة. ولا تتوقّف بالمرور
 * فوق الواجهة كلّها: مؤشّرٌ يستريح فوق العنوان — وهو موضعه الغالب — كان
 * سيُجمّد الدوران عند أكثر الزوّار.
 */
export function HeroSlides({ slides }: { slides: PublicHomeSlide[] }) {
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(prefersReducedMotion);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const count = slides.length;
  // القائمة قد تقصر تحت المؤشّر حين تحذف الإدارة صورة.
  const current = count ? index % count : 0;
  const running = count > 1 && !stopped && !focused && !hovered;

  // يُعاد المؤقّت مع كلّ انتقال (`current` في التبعيات): من ينقر نقطةً يُمهَل
  // مدّةً كاملة قبل التالية. والتبويب المخفيّ لا يتقدّم، فيعود الزائر إلى
  // الصورة التي تركها لا إلى ما دار في غيابه.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible")
        setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [running, current, count]);

  if (count === 0) return null;

  const go = (i: number) => setIndex(((i % count) + count) % count);
  const caption = slides[current]?.caption;

  return (
    <>
      {/* الصور — كلّها مرسومة، والظاهرة واحدة؛ فلا وميض عند الانتقال. */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {slides.map((s, i) => (
          <img
            key={s.id}
            src={assetUrl(s.imageUrl)}
            alt=""
            draggable={false}
            decoding="async"
            fetchPriority={i === 0 ? "high" : "low"}
            className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-[1600ms] ease-out motion-reduce:transition-none ${
              i === current
                ? "scale-100 opacity-100"
                : "scale-105 opacity-0 motion-reduce:scale-100"
            }`}
          />
        ))}
        <div className="absolute inset-0" style={SCRIM} />
      </div>

      {/* السطر والتحكّم — أسفل الواجهة، بعيداً عن العنوان. وألوانها بيضاء لا
          كريمية: تقع دائماً فوق التعتيم الداكن، و`cream` ينقلب داكناً في
          الوضع الداكن فتختفي النقاط. */}
      <div
        className="absolute inset-x-0 bottom-5 z-10 flex items-end justify-between gap-4 px-5 lg:px-8"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setFocused(false);
        }}
      >
        <p
          className="min-w-0 truncate text-[12.5px] font-medium text-white/85"
          aria-live={running ? "off" : "polite"}
        >
          {caption && (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 backdrop-blur-sm">
              <span className="size-1.5 shrink-0 rounded-full bg-gold" />
              <span className="truncate">{caption}</span>
            </span>
          )}
        </p>

        {count > 1 && (
          <SlideControls
            count={count}
            current={current}
            stopped={stopped}
            onGo={go}
            onToggle={() => setStopped((s) => !s)}
          />
        )}
      </div>
    </>
  );
}
