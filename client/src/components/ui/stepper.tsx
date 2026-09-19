import { Check } from "lucide-react";

export interface StepperItem {
  key: string;
  label: string;
}

interface Props {
  steps: StepperItem[];
  /** فهرس الخطوة الحالية. */
  current: number;
  /**
   * الرجوع إلى خطوةٍ سابقة بالنقر. لا يُمرَّر ⇒ الشريط للعرض فقط.
   * التقدّم لا يمرّ من هنا: الأمام يحرسه التحقّق في زرّ «التالي».
   */
  onGo?: (index: number) => void;
  ariaLabel?: string;
}

/**
 * شريط خطوات — عرضٌ صرف.
 *
 * لا يعرف ما الخطوات ولا متى تصحّ ولا كم عددها؛ يأخذ قائمةً ورقماً ويرسم.
 * وهذا شرط إعادة استعماله: القاعدة في مكانٍ يُختبر بلا متصفّح، والرسم هنا.
 *
 * والرجوع مسموحٌ والتقدّم ممنوع: خطوةٌ وراءك رأيتَها فلك أن تراجعها، وخطوةٌ
 * أمامك قد يحرسها حقلٌ ناقص — فلو فُتحت بالنقر لالتفّت على التحقّق.
 */
export function Stepper({ steps, current, onGo, ariaLabel }: Props) {
  return (
    <ol
      aria-label={ariaLabel}
      className="flex w-full items-start"
      data-testid="stepper"
    >
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const visited = i <= current;

        const circle = (
          <span
            className={`relative z-10 grid size-8 place-items-center rounded-full text-xs font-bold transition ${
              active
                ? "bg-gold text-forest-deep ring-4 ring-gold/20"
                : done
                  ? "bg-soft-sage text-forest"
                  : "border border-forest/15 bg-cream-2 text-clay"
            }`}
          >
            {done ? <Check size={15} /> : i + 1}
          </span>
        );

        const label = (
          <span
            className={`max-w-full truncate text-[11px] leading-tight transition ${
              active ? "font-bold text-forest" : "text-clay"
            }`}
          >
            {step.label}
          </span>
        );

        return (
          <li
            key={step.key}
            data-testid={`step-${step.key}`}
            aria-current={active ? "step" : undefined}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            {/* الواصل إلى ما قبلها — منطقيّ الاتّجاه، فينقلب مع اللغة وحده */}
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute top-4 end-1/2 h-0.5 w-full ${
                  visited ? "bg-gold" : "bg-forest/12"
                }`}
              />
            )}

            {onGo && done ? (
              <button
                type="button"
                onClick={() => onGo(i)}
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-lg px-1 outline-offset-2 transition hover:opacity-80"
              >
                {circle}
                {label}
              </button>
            ) : (
              <div className="flex min-w-0 flex-col items-center gap-1.5 px-1">
                {circle}
                {label}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
