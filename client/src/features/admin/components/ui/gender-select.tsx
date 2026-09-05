import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { UserAvatar } from "../../../../components/ui/user-avatar";

export type GenderValue = "male" | "female";

/**
 * Two choices and a way back to "not stated" — a segmented control says that
 * in one row, where a dropdown would hide it behind a click.
 *
 * Each option previews the avatar it produces, because that is the only
 * visible consequence of the field: an account with no photo is drawn from
 * this answer.
 */
export function GenderSelect({
  value,
  onChange,
  clearable = true,
}: {
  value: GenderValue | null | undefined;
  onChange: (next: GenderValue | null) => void;
  /** Editing an existing account allows returning to "not stated". */
  clearable?: boolean;
}) {
  const { t } = useTranslation();

  const options: { value: GenderValue; label: string }[] = [
    { value: "male", label: t("admin.genderMale") },
    { value: "female", label: t("admin.genderFemale") },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="grid flex-1 grid-cols-2 gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-start transition ${
                active
                  ? "border-gold bg-gold/10"
                  : "border-forest/15 bg-cream-2 hover:border-gold/40 hover:bg-forest/5"
              }`}
            >
              <UserAvatar user={{ gender: option.value }} size={26} />
              <span className="flex-1 truncate text-sm font-medium text-forest">
                {option.label}
              </span>
              {active && <Check size={15} className="shrink-0 text-gold" />}
            </button>
          );
        })}
      </div>

      {clearable && value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title={t("admin.genderClear")}
          aria-label={t("admin.genderClear")}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
