import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import type { TeamSizeRule } from "../../lib/team-size";

/**
 * عدد الطلبة في الموضوع — تقرّره الإدارة لكلّ مستوى، ولا يُكتب في النماذج.
 *
 * يُعرض ولا يُكتب: نصٌّ في إطار حقل، لا حقل، كحقل المستوى — لا تركيز ولا
 * مؤشّر كتابة. وقبل اختيار السنة والتخصّص فارغ: لا يُعرف المستوى بعد.
 * «بالضبط» عددُها. وما لم تحدّده بعدُ لمستوى الموضوع يبقى على
 * عدده — طالبٌ واحد لموضوعٍ جديد، وعددُه لموضوعٍ قائم — حتى تحدّده، ويُقال
 * ذلك، وللإدارة أين تحدّده. و«حتى» (قاعدةٌ قديمة) القيم المسموحة وحدها،
 * أزراراً. وتحته من قرّره ولأيّ مستوى وأيّ سنة. وموضوعٌ سبق القاعدة وفيه
 * طلبةٌ أكثر يبقى بعدده، ويُقال لماذا.
 */
export function TeamSizeRuled({
  rule,
  seats,
  year,
  level,
  admin = false,
  onChoose,
}: {
  /** The level's rule — `null` while the administration has set none, or the year and level are not chosen yet. */
  rule: TeamSizeRule | null;
  seats: number;
  year?: string;
  /** The level's name, as the form shows it. */
  level?: string;
  /** The administration's forms: the hint says where the number is set. */
  admin?: boolean;
  onChoose: (n: number) => void;
}) {
  const { t } = useTranslation();
  const kept = !!rule && seats > rule.n;
  // Before the year and the specialization are chosen, nothing is known: the box stays empty.
  const pending = !rule && !(year && level);
  const hint = !rule
    ? !pending
      ? t(admin ? "teamSize.unsetHintAdmin" : "teamSize.unsetHint", { level, year })
      : t("teamSize.pendingHint")
    : kept
      ? t("teamSize.keptHint", { n: rule.n })
      : t(rule.mode === "exact" ? "teamSize.exactHint" : "teamSize.maxHint", { n: rule.n, level, year });

  return (
    <div>
      {rule?.mode === "max" && !kept ? (
        <div role="radiogroup" aria-label={t("teamSize.choose")} data-testid="team-size" data-mode="max" className="flex flex-wrap gap-1.5">
          {Array.from({ length: rule.n }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={seats === n}
              aria-label={t("teamSize.count", { count: n })}
              onClick={() => onChoose(n)}
              className={`h-10 min-w-10 rounded-xl px-3 font-serif text-base font-bold tabular-nums transition ${
                seats === n
                  ? "bg-linear-to-br from-gold to-gold-soft text-[#1a312d] shadow-[0_8px_18px_-10px_rgba(193,150,90,0.9)]"
                  : "bg-cream-2 text-forest ring-1 ring-forest/15 hover:ring-gold"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <div
          data-testid="team-size"
          data-mode={rule?.mode ?? (pending ? "pending" : "unset")}
          aria-readonly="true"
          className={`flex min-h-10.5 w-full cursor-default items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold select-none ${
            rule ? "border-forest/15 bg-forest/5 text-forest" : "border-dashed border-forest/20 bg-forest/3 text-forest/80"
          }`}
        >
          <Lock size={13} className="shrink-0 text-clay" aria-hidden />
          {!pending && t("teamSize.count", { count: seats })}
        </div>
      )}
      <p
        data-testid="team-size-hint"
        className={`mt-1 text-[11px] leading-relaxed ${kept ? "text-amber-700 dark:text-amber-300" : "text-clay/80"}`}
      >
        {hint}
      </p>
    </div>
  );
}
