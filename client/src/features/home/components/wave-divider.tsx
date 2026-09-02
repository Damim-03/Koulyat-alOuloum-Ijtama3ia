/* ── Wave divider — انتقال منحنٍ من الأخضر الداكن إلى الكريمي ──
   ضعه بعد NewsTicker مباشرة (قبل القسم الكريمي). */
export function WaveDivider() {
  return (
    <div className="relative h-12 overflow-hidden bg-forest-deep sm:h-16">
      <svg
        className="page-fill-2 absolute bottom-0 w-full"
        viewBox="0 0 1440 64"
        fill="currentColor"
        preserveAspectRatio="none"
      >
        <path d="M0,8 C360,56 720,56 1080,24 C1260,8 1380,4 1440,8 L1440,64 L0,64 Z" />
      </svg>
    </div>
  );
}
