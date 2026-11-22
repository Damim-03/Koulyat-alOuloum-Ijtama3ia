import { useTranslation } from "react-i18next";
import { GraduationCap, Loader2, SearchX } from "lucide-react";
import { UserAvatar } from "./user-avatar";

/** A student offered in a list: who, by which number — and the face, when there is one. */
export interface StudentOption {
  id: string;
  reg: string;
  name: string;
  user?: unknown;
  specialization?: string | null;
}

/**
 * قائمةُ الطلبة تحت حقلٍ يُكتب فيه — في مقاعد الإسناد (الإدارة) وفي فريق
 * الأستاذ المقترَح.
 *
 * تُفتح بالضغط على الحقل أو زرّ القائمة، فتعرض طلبة تخصّص الموضوع الأحرار؛
 * وما يُكتب يضيّقها: رقم تسجيل، أو حروفٌ من الاسم واللقب بأيّ ترتيب. وتقول
 * كم بقي خارجها، فيُعرف أنّ الكتابة تضيّق. وتُسيَّر بالأسهم وEnter.
 */
export function StudentOptions({
  id,
  options,
  loading,
  total,
  title,
  active,
  onActive,
  onPick,
}: {
  /** The listbox's id — the field's `aria-controls`. */
  id: string;
  options: StudentOption[];
  loading: boolean;
  /** How many match in all, the shown among them. */
  total: number;
  title: string;
  active: number;
  onActive: (i: number) => void;
  onPick: (s: StudentOption) => void;
}) {
  const { t } = useTranslation();
  const more = Math.max(0, total - options.length);
  return (
    <div
      className="animate-scale-in absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border border-forest/12 bg-cream-card shadow-[0_18px_44px_-18px_rgba(10,20,17,0.55)]"
      data-testid="student-options"
    >
      <p className="flex items-center gap-1.5 border-b border-forest/8 bg-cream-2/70 px-3 py-2 text-[11px] font-bold text-clay">
        <GraduationCap size={13} className="text-gold" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {loading && <Loader2 size={13} className="animate-spin" />}
      </p>
      <ul id={id} role="listbox" aria-label={title} className="max-h-64 overflow-y-auto py-1">
        {!loading && options.length === 0 && (
          <li className="flex items-center justify-center gap-2 px-3 py-4 text-[12px] text-clay">
            <SearchX size={14} />
            {t("studentOptions.none")}
          </li>
        )}
        {options.map((s, i) => (
          <li
            key={s.id}
            role="option"
            aria-selected={i === active}
            // A press, not a click: the field keeps its focus, and the list is not closed under the pointer.
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(s);
            }}
            onMouseEnter={() => onActive(i)}
            className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 transition ${i === active ? "bg-gold/12" : "hover:bg-forest/5"}`}
          >
            <UserAvatar user={s.user} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-forest">{s.name || s.reg}</span>
              <span className="block truncate text-[11px] text-clay">
                <span dir="ltr">{s.reg}</span>
                {s.specialization && ` · ${s.specialization}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="border-t border-forest/8 px-3 py-2 text-[11px] text-clay" data-testid="student-options-more">
          {t("studentOptions.more", { n: more })}
        </p>
      )}
    </div>
  );
}
