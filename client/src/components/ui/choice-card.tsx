import type { LucideIcon } from "lucide-react";

/**
 * خيارٌ من خياراتٍ متنافية، بطاقةً: أيقونته، وعنوانه، وسطرٌ يقول ما يفعل،
 * ودائرة الاختيار. يوضع في `role="radiogroup"`.
 */
export function ChoiceCard({
  icon: Icon,
  title,
  hint,
  on,
  onPick,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  on: boolean;
  onPick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      data-testid={testId}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-start transition ${
        on ? "border-gold/60 bg-gold/10 shadow-[0_8px_20px_-14px_rgba(193,150,90,0.9)]" : "border-forest/12 hover:border-forest/25 hover:bg-forest/3"
      }`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? "bg-gold/20 text-gold" : "bg-forest/6 text-clay"}`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm text-forest">{title}</b>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-clay">{hint}</span>
      </span>
      <span
        aria-hidden
        className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border ${on ? "border-gold bg-gold" : "border-forest/25"}`}
      >
        {on && <span className="size-1.5 rounded-full bg-white" />}
      </span>
    </button>
  );
}
