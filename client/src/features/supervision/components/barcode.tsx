import { ean13Modules, isGuardModule } from "../lib/ean13";

/** وحداتُ الهدوء التي يشترطها المعيار على الجانبين — بلا بياضٍ لا يُمسح. */
const QUIET_START = 9;
const QUIET_END = 7;
const MODULES = 95;
const WIDTH = QUIET_START + MODULES + QUIET_END;

const BAR_H = 30;
const GUARD_H = 35;

/**
 * الرمزُ الشريطيّ أسفل الورقة.
 *
 * مرسومٌ `svg` لا صورةً نقطية: يخرج من الطابعة بحدٍّ حادٍّ مهما كانت
 * دقّتها، وصورةٌ نقطية بعرض ٦٠مم تخرج مشوّشةَ الحواف فيتعثّر القارئ فيها.
 *
 * ووحداتُ الهدوء داخل `viewBox` لا خارجه: لو تُركت لفراغ الصفحة لَضاعت
 * يوم يُوضع الرمز في صندوقٍ ضيّق، والمعيار يرفض رمزاً بلا بياضٍ حوله.
 *
 * و`preserveAspectRatio="none"` مقصود: العرض والارتفاع يُملَيان بالمليمتر
 * من الورقة، والنسبةُ بين الخطوط محفوظةٌ في `viewBox` على كلّ حال.
 */
export function Ean13Barcode({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const modules = ean13Modules(value);
  if (!modules) return null;

  const bars: { x: number; height: number }[] = [];
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== "1") continue;
    bars.push({
      x: QUIET_START + i,
      height: isGuardModule(i) ? GUARD_H : BAR_H,
    });
  }

  return (
    <svg
      className={className}
      viewBox={`0 0 ${WIDTH} ${GUARD_H}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={value}
    >
      <rect x="0" y="0" width={WIDTH} height={GUARD_H} fill="#fff" />
      {bars.map((bar) => (
        <rect
          key={bar.x}
          x={bar.x}
          y={0}
          width={1}
          height={bar.height}
          fill="#000"
        />
      ))}
    </svg>
  );
}
