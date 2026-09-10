import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, X, Plus, Loader2 } from "lucide-react";
import { useSearchStudents } from "../hooks/Professor-hook";
import { UserAvatar } from "../../../components/ui/user-avatar";
import type { StudentSearchHit } from "../../../types/professor.types";

/**
 * Naming the students for a proposed team.
 *
 * Typed registration numbers alone put the burden on the professor to
 * remember twelve digits exactly, and a typo only surfaced on submit. This
 * searches as he types — by number or by name — and he picks from what comes
 * back, so the number is never keyed in full.
 *
 * Typing a number the search does not surface is still allowed: the backend
 * resolves every number on submit and names any that does not exist, so the
 * picker never becomes the only way in.
 */

export interface PickedStudent {
  registrationNumber: string;
  name: string;
}

function nameOf(hit: StudentSearchHit) {
  return (
    [hit.user?.firstName, hit.user?.lastName].filter(Boolean).join(" ") ||
    hit.registrationNumber
  );
}

export function StudentPicker({
  value,
  onChange,
  max,
  specializationId,
}: {
  value: PickedStudent[];
  onChange: (next: PickedStudent[]) => void;
  max: number;
  /** Narrows the search to the topic's specialization when one is chosen. */
  specializationId?: string;
}) {
  const { t } = useTranslation();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  const { data: hits, isFetching } = useSearchStudents(
    debounced,
    specializationId,
  );

  const chosen = new Set(value.map((v) => v.registrationNumber));
  const results = (hits ?? []).filter(
    (h) => !chosen.has(h.registrationNumber),
  );
  const full = value.length >= max;

  function add(student: PickedStudent) {
    if (full || chosen.has(student.registrationNumber)) return;
    onChange([...value, student]);
    setTerm("");
    setDebounced("");
  }

  function remove(reg: string) {
    onChange(value.filter((v) => v.registrationNumber !== reg));
  }

  // A number typed in full and confirmed, for a student the search did not
  // offer. Verified on submit like every other one.
  const typedIsNew =
    term.trim().length >= 2 &&
    !chosen.has(term.trim()) &&
    !results.some((r) => r.registrationNumber === term.trim());

  return (
    <div>
      {/* ── the team so far ── */}
      {value.length > 0 && (
        <ul className="mb-2 space-y-2">
          {value.map((s) => (
            <li
              key={s.registrationNumber}
              className="flex items-center gap-2.5 rounded-xl border border-forest/10 bg-cream-card px-3 py-2"
            >
              <UserAvatar user={{}} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-forest">
                  {s.name}
                </span>
                <span className="block truncate text-[11px] text-clay" dir="ltr">
                  {s.registrationNumber}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(s.registrationNumber)}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-brick/10 hover:text-brick"
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div className="relative">
          <Search
            className="absolute top-1/2 end-3 -translate-y-1/2 text-clay"
            size={16}
          />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("pro.searchStudentToPropose")}
            className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2 pe-9 ps-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 placeholder:text-clay/50"
          />

          {debounced.length >= 2 && (
            <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-forest/10 bg-cream-card">
              {isFetching && (
                <p className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-clay">
                  <Loader2 size={13} className="animate-spin" />
                  {t("pro.searching")}
                </p>
              )}

              {!isFetching && results.length === 0 && (
                <p className="px-3 py-3 text-center text-xs text-clay">
                  {t("pro.noStudentsFound")}
                </p>
              )}

              {!isFetching &&
                results.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() =>
                      add({
                        registrationNumber: h.registrationNumber,
                        name: nameOf(h),
                      })
                    }
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition hover:bg-forest/5"
                  >
                    <UserAvatar user={h.user} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-forest">
                        {nameOf(h)}
                      </span>
                      <span className="block truncate text-[11px] text-clay">
                        <span dir="ltr">{h.registrationNumber}</span>
                        {h.specialization && ` · ${h.specialization.name}`}
                      </span>
                    </span>
                  </button>
                ))}

              {/* the escape hatch, offered rather than assumed */}
              {!isFetching && typedIsNew && (
                <button
                  type="button"
                  onClick={() =>
                    add({
                      registrationNumber: term.trim(),
                      name: term.trim(),
                    })
                  }
                  className="flex w-full items-center gap-2 border-t border-forest/10 px-3 py-2 text-start text-[11px] font-medium text-gold transition hover:bg-gold/5"
                >
                  <Plus size={12} />
                  {t("pro.useTypedNumber", { number: term.trim() })}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {full && (
        <p className="rounded-xl bg-cream-2/70 px-3 py-2 text-[11px] text-clay">
          {t("pro.teamFull", { count: max })}
        </p>
      )}
    </div>
  );
}
