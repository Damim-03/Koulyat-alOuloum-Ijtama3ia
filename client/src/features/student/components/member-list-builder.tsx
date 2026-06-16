import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /** أقصى عدد زملاء يمكن إضافتهم (بدون القائد). */
  max?: number;
  disabled?: boolean;
};

/**
 * بنّاء قائمة أرقام تسجيل الزملاء: إدخال + زرّ إضافة + رقائق قابلة للحذف.
 * مكوّن متحكَّم به (controlled): يستقبل value/onChange.
 */
export function MemberListBuilder({ value, onChange, max, disabled }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const atCapacity = max != null && value.length >= max;

  function add() {
    const reg = draft.trim();
    if (!reg) return;
    if (value.includes(reg)) {
      setError(t("stu.duplicateMember"));
      return;
    }
    if (atCapacity) {
      setError(t("stu.capacityReached"));
      return;
    }
    onChange([...value, reg]);
    setDraft("");
    setError(null);
  }

  function remove(reg: string) {
    onChange(value.filter((r) => r !== reg));
    setError(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || atCapacity}
          placeholder={t("stu.regNumberPlaceholder")}
          className="min-w-0 flex-1 rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled || atCapacity || !draft.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream-2 transition hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" />
          {t("stu.addMember")}
        </button>
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      {/* chips */}
      {value.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((reg) => (
            <span
              key={reg}
              className="inline-flex items-center gap-1.5 rounded-lg bg-soft-sage/20 px-3 py-1.5 text-sm font-medium text-forest ring-1 ring-sage/20"
            >
              <span dir="ltr">{reg}</span>
              <button
                type="button"
                onClick={() => remove(reg)}
                disabled={disabled}
                aria-label="remove"
                className="grid size-4 place-items-center rounded-full text-sage transition hover:bg-sage/20 hover:text-forest"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-clay">{t("stu.noTeammatesYet")}</p>
      )}
    </div>
  );
}
