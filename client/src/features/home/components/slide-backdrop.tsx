import { useEffect, useState } from "react";
import { assetUrl } from "../../../lib/asset-url";
import type { PublicHomeSlide } from "../../../types/site.types";
import { SlideControls } from "./slide-controls";

/** مدّة بقاء الصورة قبل أن تخلفها التالية — أبطأ من الرئيسية: هي خلفيةٌ لا معرض. */
const INTERVAL_MS = 9000;

/**
 * التعتيم: من لون العلامة الداكن الثابت (`--t-brand-deep`) لا أسود، فيبقى
 * الرأس أخضر الطابع أيّاً كانت الصورة.
 *
 * - `center` — للوحة الترحيب في صفحة الدخول: أخفّ في الوسط حيث الشعار،
 *   وأثقل عند الحوافّ وفي الأسفل حيث النصّ الصغير.
 * - `wash` — لرأس «عن المنصة»: غشاوةٌ متساوية فوق الصورة كلّها، فالعنوان في
 *   طرفٍ وساحة الصور في الآخر؛ وتذوب في الأخضر من الأسفل حيث شريط الأرقام.
 */
const SCRIMS = {
  center: {
    background: [
      "radial-gradient(ellipse 85% 70% at 50% 40%, color-mix(in srgb, var(--t-brand-deep) 58%, transparent) 0%, color-mix(in srgb, var(--t-brand-deep) 84%, transparent) 100%)",
      "linear-gradient(to top, var(--t-brand-deep) 0%, transparent 45%)",
    ].join(","),
  },
  wash: {
    background: [
      "linear-gradient(to top, var(--t-brand-deep) 0%, transparent 38%)",
      "linear-gradient(color-mix(in srgb, var(--t-brand-deep) 76%, transparent) 0 0)",
    ].join(","),
  },
} as const;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * صورٌ تختارها الإدارة من «واجهة الموقع» خلفيةً لرأسٍ أخضر — لوحة الترحيب
 * في صفحة الدخول، ورأس «عن المنصة».
 *
 * صورةٌ واحدة تبقى ثابتة؛ وأكثر منها تتعاقب ببطء. والظاهرة تقترب قليلاً على
 * مهل، إلّا لمن طلب من نظامه تقليل الحركة — فلا تقترب، ولا يبدأ التعاقب.
 *
 * و`controls` تضيف أزرار الرئيسية نفسها (السابقة والنقاط والتالية والإيقاف)
 * حيث يضعها `controlsClassName`؛ والتعاقب يتوقّف ما دام المؤشّر أو التركيز
 * عليها. ولوحة الدخول بلا أزرار: زائرها جاء ليكتب بياناته.
 *
 * ولا تظهر صورةٌ قبل أن تكتمل: تنساب فوق الأخضر بدل أن تُرسم سطراً سطراً.
 */
export function SlideBackdrop({
  slides,
  variant = "center",
  controls = false,
  controlsClassName = "bottom-5 end-5",
}: {
  slides: PublicHomeSlide[];
  variant?: keyof typeof SCRIMS;
  controls?: boolean;
  /** موضع الأزرار داخل الرأس (`absolute`). */
  controlsClassName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [still] = useState(prefersReducedMotion);
  const [stopped, setStopped] = useState(still);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());

  const count = slides.length;
  // القائمة قد تقصر حين تحذف الإدارة صورة.
  const current = count ? index % count : 0;
  const running = count > 1 && !stopped && !hovered && !focused;

  // يُعاد المؤقّت مع كلّ انتقال: من ينقر نقطةً يُمهَل مدّةً كاملة قبل التالية.
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

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {slides.map((s, i) => {
          const shown = i === current && loaded.has(s.id);
          return (
            <img
              key={s.id}
              src={assetUrl(s.imageUrl)}
              alt=""
              draggable={false}
              decoding="async"
              fetchPriority={i === 0 ? "high" : "low"}
              onLoad={() =>
                setLoaded((l) => (l.has(s.id) ? l : new Set(l).add(s.id)))
              }
              style={{
                transition: "opacity 1.8s ease-out, transform 10s ease-out",
              }}
              className={`absolute inset-0 size-full object-cover ${shown ? "opacity-100" : "opacity-0"} ${
                shown && !still ? "scale-[1.06]" : "scale-100"
              }`}
            />
          );
        })}
        <div className="absolute inset-0" style={SCRIMS[variant]} />
      </div>

      {controls && count > 1 && (
        <div
          className={`absolute z-10 ${controlsClassName}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              setFocused(false);
          }}
        >
          <SlideControls
            count={count}
            current={current}
            stopped={stopped}
            onGo={go}
            onToggle={() => setStopped((v) => !v)}
          />
        </div>
      )}
    </>
  );
}
