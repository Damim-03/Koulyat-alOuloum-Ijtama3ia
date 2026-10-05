import { useTranslation } from "react-i18next";
import {
  SPEC_LEVEL_KEY,
  SPEC_LEVELS,
  type SpecLevel,
} from "../dialog/user/user-form-steps";

/**
 * المستوى — ليسانس، ماستر، دكتوراه — فلترٌ يضيّق قائمة التخصصات.
 *
 * ثلاثة أزرارٍ لا قائمة، كما في نافذة التخصص: ثلاثة خيارات تُقرأ بنظرة.
 * والنقر على المختار يُلغيه فتعود القائمة كاملة. وبجانب كلّ مستوى عددُ
 * تخصصاته في النطاق الحالي، ويُطفأ ما لا تخصص له: خيارٌ يُفرغ القائمة فخٌّ.
 *
 * لا يُحفظ: المستوى صفةٌ للتخصص، والطالب يُسجَّل في تخصصٍ لا في مستوى.
 */
export function LevelPicker({
  value,
  counts,
  onChange,
}: {
  value: SpecLevel | "";
  counts: Record<SpecLevel, number>;
  onChange: (next: SpecLevel | "") => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("admin.specializationLevel")}
      data-testid="level-picker"
      className="grid grid-cols-3 gap-2"
    >
      {SPEC_LEVELS.map((lv) => {
        const active = value === lv;
        return (
          <button
            key={lv}
            type="button"
            aria-pressed={active}
            disabled={counts[lv] === 0 && !active}
            data-testid={`level-${lv}`}
            onClick={() => onChange(active ? "" : lv)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              active
                ? "border-gold bg-gold/15 text-forest"
                : "border-forest/15 bg-cream-2 text-clay hover:border-gold/50 hover:text-forest"
            }`}
          >
            {t(SPEC_LEVEL_KEY[lv])}
            <span
              className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                active ? "bg-gold text-[var(--t-brand-deep)]" : "bg-forest/8 text-clay"
              }`}
            >
              {counts[lv]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
