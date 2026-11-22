import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** مقاسُ الورقة بالبكسل عند ٩٦ نقطة/بوصة — عليه يُحسب تصغير المعاينة. */
const SHEET_W = 794;
const SHEET_H = 1123;

/**
 * إطارُ المعاينة: يقيس عرضه ويُصغّر الورقة لتملأه، بلا مقياسٍ مكتوبٍ سلفاً.
 *
 * كان المقياس ثابتاً (٠٫٥٢ ثمّ ٠٫٧) فيخرج خطُّ الورقة صغيراً على الشاشات
 * الواسعة وتفيض على الضيّقة. وصار يتبع عرض العمود: على شاشةٍ كبيرة تُعرض
 * الورقة بحجمها الطبيعيّ — ولا يُكبَّر فوقه، لأنّ تكبير المعاينة لا يزيد
 * المطبوع وضوحاً، إنّما يُشوّشها.
 *
 * والارتفاعُ يُحجز مُصغَّراً (`SHEET_H * scale`) لأنّ `transform` لا يُنقص
 * المساحة التي يشغلها العنصر؛ ولولا ذلك لبقي تحت الورقة فراغٌ بطول الفرق.
 *
 * ويُستعمل في نافذة الإصدار وفي محرّر الورقة من «واجهة الموقع».
 */
export function SheetPreviewFrame({ children }: { children: ReactNode }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.7);

  useLayoutEffect(() => {
    const el = holder.current;
    if (!el) return;

    function measure() {
      const width = el?.clientWidth ?? 0;
      if (width) setScale(Math.min(1, width / SHEET_W));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={holder}
      className="sup-print-pass relative mx-auto w-full"
      style={{ height: Math.round(SHEET_H * scale) }}
    >
      <div
        className="sup-print-pass absolute top-0 left-1/2 origin-top shadow-[0_8px_30px_rgba(0,0,0,0.28)]"
        style={{
          width: SHEET_W,
          marginLeft: -SHEET_W / 2,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
