import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLanguage } from "../../../../hooks/use-language";
import { assetUrl } from "../../../../lib/asset-url";
import type { PublicHomeSlide } from "../../../../types/site.types";

const INTERVAL_MS = 6000;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * - `hero`: ساحة الصور في رأس «عن المنصة» — إطارٌ 4:3، وأشرطة تقدّمٍ في أعلاه
 *   على طريقة القصص، بلا مصغّرات.
 * - `full`: معرضٌ عريض 16:9 بمصغّراتٍ تحته.
 * - `compact`: معاينة لوحة الإدارة — بلا مصغّراتٍ ولا إيقاف.
 */
export type GalleryVariant = "hero" | "full" | "compact";

/**
 * صور المنصّة تتعاقب — في رأس «عن المنصة»، وفي معاينة لوحة الإدارة.
 *
 * الصور هنا محتوىً لا خلفية، فتُعرض كاملةً لا مقصوصة: لقطة شاشةٍ عريضة أو صورةٌ
 * عمودية تأخذ مكانها كما هي، وفراغ الإطار تملؤه نسخةٌ مغبَّشة منها بدل شريطين
 * أسودين. والسطر المرافق تحتها مقروءٌ نصّاً.
 *
 * والتحكّم كاملٌ لمن شاء: سهمان، ولوحة المفاتيح، والسحب باللمس، وزرّ إيقاف،
 * والأشرطة أو المصغّرات للقفز. والدوران يتوقّف ما دام المؤشّر فوقه، ولا يبدأ
 * لمن طلب تقليل الحركة.
 *
 * وفي `hero` يقود شريطُ التقدّم الدورانَ نفسه: انتهاءُ امتلائه ينقل إلى التالية.
 * مؤقّتٌ منفصلٌ كان سيفترق عن الشريط بعد أوّل إيقافٍ بالمرور — يُستأنف الشريط
 * من حيث وقف، ويبدأ المؤقّت من جديد.
 *
 * والإطار `overflow-clip` لا `overflow-hidden`: الخلفية المغبَّشة مكبَّرةٌ فتفيض
 * عنه، والمخفيّ يبقى قابلاً للتمرير برمجياً — فكان التركيز على سهمٍ يزيح
 * محتوى الإطار كلّه خمسين بكسلاً جانباً، فيخرج أحد السهمين من الصورة.
 */
export function PlatformGallery({
  slides,
  variant = "full",
}: {
  slides: PublicHomeSlide[];
  variant?: GalleryVariant;
}) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(prefersReducedMotion);
  const [hovered, setHovered] = useState(false);
  const swipeFrom = useRef<number | null>(null);

  const isHero = variant === "hero";
  const compact = variant === "compact";
  const count = slides.length;
  const current = count ? index % count : 0;
  const running = count > 1 && !stopped && !hovered;

  // في `hero` يتقدّم الدوران بانتهاء شريط التقدّم، فلا مؤقّت.
  useEffect(() => {
    if (!running || isHero) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => (i + 1) % count);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [running, isHero, current, count]);

  if (count === 0) return null;

  const go = (i: number) => setIndex(((i % count) + count) % count);
  const prev = () => go(current - 1);
  const next = () => go(current + 1);
  // «السابق» نحو بداية السطر: يمينٌ في العربية.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const caption = slides[current]?.caption;

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft") (isRTL ? next : prev)();
    else if (e.key === "ArrowRight") (isRTL ? prev : next)();
  }

  function onPointerUp(e: PointerEvent) {
    if (swipeFrom.current === null) return;
    const dx = e.clientX - swipeFrom.current;
    swipeFrom.current = null;
    if (Math.abs(dx) < 40) return;
    // السحب نحو بداية السطر يُظهر التالي، كما يُقلَّب كتابٌ بلغته.
    const towardStart = isRTL ? dx > 0 : dx < 0;
    (towardStart ? next : prev)();
  }

  const shape = isHero
    ? "aspect-[4/3] rounded-[1.6rem]"
    : compact
      ? "aspect-video rounded-xl"
      : "aspect-video rounded-3xl shadow-[0_30px_80px_-30px_rgba(22,36,31,0.55)]";

  return (
    <div className="w-full">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label={t("aboutPage.galleryLabel")}
        tabIndex={compact ? -1 : 0}
        onKeyDown={onKey}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerDown={(e) => (swipeFrom.current = e.clientX)}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeFrom.current = null)}
        className={`group relative w-full touch-pan-y select-none overflow-clip bg-[var(--t-brand-deep)] outline-none focus-visible:ring-2 focus-visible:ring-gold ${shape}`}
      >
        {slides.map((s, i) => {
          const src = assetUrl(s.imageUrl);
          const on = i === current;
          return (
            <div
              key={s.id}
              aria-hidden={!on}
              className={`absolute inset-0 overflow-hidden transition-opacity duration-700 motion-reduce:transition-none ${
                on ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <img src={src} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl" />
              <img
                src={src}
                alt={s.caption ?? ""}
                draggable={false}
                loading={i === 0 ? "eager" : "lazy"}
                className={`relative size-full object-contain ${
                  isHero
                    ? `transition-transform duration-[2500ms] ease-out motion-reduce:transition-none ${on ? "scale-100" : "scale-[1.06]"}`
                    : ""
                }`}
              />
            </div>
          );
        })}

        {/* أشرطة التقدّم — في `hero` وحده */}
        {isHero && count > 1 && (
          <div className="absolute inset-x-4 top-4 z-10 flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={t("hero.slides.goTo", { n: i + 1, total: count })}
                aria-current={i === current ? "true" : undefined}
                className="group/bar flex h-4 flex-1 items-center"
              >
                <span className="block h-[3px] w-full overflow-hidden rounded-full bg-white/25 transition group-hover/bar:bg-white/40">
                  {i < current && <span className="block size-full bg-gold-soft" />}
                  {i === current &&
                    (stopped ? (
                      <span className="block size-full bg-gold-soft" />
                    ) : (
                      <span
                        key={`fill-${current}`}
                        onAnimationEnd={next}
                        className={`block size-full bg-gold-soft ${isRTL ? "origin-right" : "origin-left"}`}
                        style={{
                          animation: `galleryFill ${INTERVAL_MS}ms linear forwards`,
                          animationPlayState: running ? "running" : "paused",
                        }}
                      />
                    ))}
                </span>
              </button>
            ))}
            <style>{`@keyframes galleryFill { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
          </div>
        )}

        {/* السطر والعدّاد */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-linear-to-t from-black/70 via-black/25 to-transparent px-4 pb-3 pt-12 sm:px-6 sm:pb-4">
          <p
            dir="auto"
            className={`min-w-0 font-semibold text-white drop-shadow ${compact ? "truncate text-[11px]" : "text-sm sm:text-base"}`}
          >
            {caption}
          </p>
          {count > 1 && !isHero && (
            <span className="shrink-0 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold tabular-nums text-white/90 backdrop-blur-sm">
              {current + 1} / {count}
            </span>
          )}
        </div>

        {count > 1 && (
          <>
            <Arrow side="start" label={t("hero.slides.previous")} onClick={prev} compact={compact}>
              <PrevIcon size={compact ? 16 : 22} />
            </Arrow>
            <Arrow side="end" label={t("hero.slides.next")} onClick={next} compact={compact}>
              <NextIcon size={compact ? 16 : 22} />
            </Arrow>
            {!compact && (
              <button
                type="button"
                onClick={() => setStopped((v) => !v)}
                aria-label={stopped ? t("hero.slides.play") : t("hero.slides.pause")}
                title={stopped ? t("hero.slides.play") : t("hero.slides.pause")}
                className={`absolute end-3 z-10 grid size-9 place-items-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm transition hover:bg-black/60 ${
                  isHero ? "top-10" : "top-3"
                }`}
              >
                {stopped ? <Play size={15} /> : <Pause size={15} />}
              </button>
            )}
          </>
        )}
      </div>

      {/* المصغّرات — في `full` وحده */}
      {variant === "full" && count > 1 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={t("hero.slides.goTo", { n: i + 1, total: count })}
              aria-current={i === current ? "true" : undefined}
              className={`relative h-14 w-24 overflow-hidden rounded-xl transition sm:h-16 sm:w-28 ${
                i === current
                  ? "ring-2 ring-gold ring-offset-2 ring-offset-transparent"
                  : "opacity-55 hover:opacity-90"
              }`}
            >
              <img src={assetUrl(s.imageUrl)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Arrow({
  side,
  label,
  onClick,
  compact,
  children,
}: {
  side: "start" | "end";
  label: string;
  onClick: () => void;
  compact: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[#1a312d] shadow-lg transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${
        side === "start" ? "start-3" : "end-3"
      } ${compact ? "size-7" : "size-11"}`}
    >
      {children}
    </button>
  );
}
