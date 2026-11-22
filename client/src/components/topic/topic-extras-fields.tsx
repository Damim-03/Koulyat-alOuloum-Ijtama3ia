import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search, Tag, UserPlus, X } from "lucide-react";

import { useProfessorOptions, useTopicTypeOptions } from "../../hooks/use-topic-lookups";
import { SUMMARY_MAX, deeper, type TopicExtrasValue } from "../../lib/topic-extras";
import { personName, otherScriptName } from "../../lib/person-name";
import { foldText, searchWords } from "../../lib/search-text";
import { CharCount } from "../ui/char-count";
import { Field, inputCls } from "../ui/form-bits";
import type { ProfessorOption } from "../../types/topic-extras";

/**
 * The type, the co-supervisor and the short description of a topic — the
 * same three fields in every topic form, the administration's and the
 * professor's.
 *
 * The types are those of the specialization's department (none until one is
 * chosen); the co-supervisor is a professor of the platform — never a name
 * typed in — and never the supervisor. When the specialization or the
 * supervisor changes under a choice that no longer holds, the choice is
 * dropped rather than sent to be refused.
 */
export function TopicExtrasFields({
  value,
  onChange,
  specializationId,
  supervisorId,
}: {
  value: TopicExtrasValue;
  onChange: (v: TopicExtrasValue) => void;
  specializationId?: string;
  /** The supervisor, kept out of the co-supervisors. */
  supervisorId?: string;
}) {
  const { t } = useTranslation();
  const typesQ = useTopicTypeOptions(specializationId);
  const types = useMemo(() => typesQ.data ?? [], [typesQ.data]);

  // A type of another department, once the specialization moved: dropped.
  const staleType = !!value.typeId && !!specializationId && typesQ.isSuccess && !types.some((x) => x.id === value.typeId);
  const staleCo = !!value.coSupervisorId && value.coSupervisorId === supervisorId;
  useEffect(() => {
    if (staleType || staleCo)
      onChange({ ...value, typeId: staleType ? "" : value.typeId, coSupervisorId: staleCo ? "" : value.coSupervisorId });
  }, [staleType, staleCo, value, onChange]);

  return (
    <div className="space-y-4" data-testid="topic-extras">
      <Field label={t("topicExtras.type")} note={t("topicExtras.optional")} hint={t("topicExtras.typeHint")} group>
        {!specializationId ? (
          <p className="rounded-xl border border-dashed border-forest/15 px-3 py-2.5 text-[12px] text-clay">{t("topicExtras.typePickSpec")}</p>
        ) : typesQ.isSuccess && !types.length ? (
          <p className="rounded-xl border border-dashed border-forest/15 px-3 py-2.5 text-[12px] text-clay" data-testid="topic-types-empty">
            {t("topicExtras.typeEmpty")}
          </p>
        ) : (
          <div role="radiogroup" aria-label={t("topicExtras.type")} className="flex flex-wrap gap-1.5">
            <TypeChoice on={!value.typeId} onClick={() => onChange({ ...value, typeId: "" })} label={t("topicExtras.typeNone")} />
            {types.map((x) => (
              <TypeChoice
                key={x.id}
                on={value.typeId === x.id}
                onClick={() => onChange({ ...value, typeId: x.id })}
                label={x.name}
                code={x.code}
                color={x.color}
              />
            ))}
          </div>
        )}
      </Field>

      <Field label={t("topicExtras.coSupervisor")} note={t("topicExtras.optional")} hint={t("topicExtras.coSupervisorHint")} group>
        <CoSupervisorPicker
          value={value.coSupervisorId}
          exclude={supervisorId}
          onChange={(coSupervisorId) => onChange({ ...value, coSupervisorId })}
        />
      </Field>

      <Field label={t("topicExtras.summary")} note={t("topicExtras.optional")} hint={t("topicExtras.summaryHint")}>
        <textarea
          value={value.summary}
          maxLength={SUMMARY_MAX}
          rows={2}
          onChange={(e) => onChange({ ...value, summary: e.target.value })}
          placeholder={t("topicExtras.summaryPlaceholder")}
          className={`${inputCls} resize-y`}
          data-testid="topic-summary"
        />
        <CharCount value={value.summary} max={SUMMARY_MAX} className="mt-1" />
      </Field>
    </div>
  );
}

function TypeChoice({ on, onClick, label, code, color }: { on: boolean; onClick: () => void; label: string; code?: string; color?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ${
        on ? "border-gold bg-gold/12 text-forest ring-2 ring-gold/30" : "border-forest/15 bg-cream text-clay hover:border-forest/30 hover:text-forest"
      }`}
    >
      {color ? (
        <span className="size-3 shrink-0 rounded-full" style={{ background: color, boxShadow: `inset 0 0 0 1.5px ${deeper(color)}` }} />
      ) : (
        <Tag size={12} />
      )}
      {code && (
        <span dir="ltr" className="font-mono text-[11px] text-forest/80">
          {code}
        </span>
      )}
      <span>{label}</span>
      {on && <Check size={12} className="text-gold" />}
    </button>
  );
}

/** A professor of the platform, searched by name in either script or by department. */
function CoSupervisorPicker({ value, exclude, onChange }: { value: string; exclude?: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const { data, isLoading } = useProfessorOptions();
  const all = useMemo(() => data ?? [], [data]);
  const selected = all.find((p) => p.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const results = useMemo(() => {
    const words = searchWords(term);
    const pool = all.filter((p) => p.id !== exclude && !p.isMe);
    if (!words.length) return pool.slice(0, 50);
    return pool
      .filter((p) => {
        const hay = foldText([p.firstName, p.lastName, p.firstNameLatin, p.lastNameLatin, p.department.name].filter(Boolean).join(" "));
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 50);
  }, [all, term, exclude]);

  const pick = (p: ProfessorOption | null) => {
    onChange(p?.id ?? "");
    setOpen(false);
    setTerm("");
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="co-supervisor-trigger"
        className="flex min-h-[46px] w-full items-center justify-between gap-2 rounded-xl border border-forest/15 bg-cream px-3 py-2 text-start text-sm outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
      >
        {selected ? (
          <span className="min-w-0">
            <span className="block truncate text-forest">{personName(selected)}</span>
            <span className="block truncate text-[10.5px] text-clay">{selected.department.name}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 truncate text-clay">
            <UserPlus size={15} />
            {value && isLoading ? "…" : t("topicExtras.coSupervisorPick")}
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("topicExtras.clear")}
              onClick={(e) => {
                e.stopPropagation();
                pick(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  pick(null);
                }
              }}
              className="grid size-5 place-items-center rounded text-clay transition hover:bg-forest/10 hover:text-forest"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={16} className={`text-clay transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-forest/15 bg-cream-card shadow-[0_12px_32px_rgba(38,66,61,0.18)]">
          <div className="relative border-b border-forest/10 p-2">
            <Search className="absolute end-4 top-1/2 -translate-y-1/2 text-clay" size={15} />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t("topicExtras.coSupervisorSearch")}
              aria-label={t("topicExtras.coSupervisorSearch")}
              className="w-full rounded-lg bg-cream px-3 py-2 pe-9 text-sm text-forest outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            {results.map((p) => {
              const on = p.id === value;
              const other = otherScriptName(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => pick(p)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start transition ${on ? "bg-gold/12" : "hover:bg-forest/5"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-forest">{personName(p)}</span>
                      <span className="block truncate text-[10.5px] text-clay">
                        {other && <bdi>{other} · </bdi>}
                        {p.department.name}
                      </span>
                    </span>
                    {on && <Check size={14} className="shrink-0 text-gold" />}
                  </button>
                </li>
              );
            })}
            {!results.length && <li className="px-3 py-4 text-center text-[12px] text-clay">{isLoading ? "…" : t("topicExtras.coSupervisorNone")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
