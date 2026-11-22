import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Building2, Check, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";

import { useCreateTopicType, useDeleteTopicType, useDepartments, useTopicTypes, useUpdateTopicType } from "../../../hooks/admin-hook";
import { Select } from "../../../../../components/ui/select";
import { LoadingArea } from "../../../../../components/ui/loading-area";
import { inputCls } from "../../../../../components/ui/form-bits";
import { TopicTypeBadge } from "../../../../../components/topic/topic-type-badge";
import { TYPE_COLORS, deeper } from "../../../../../lib/topic-extras";
import type { TopicTypeRow } from "../../../../../types/topic-extras";

/**
 * أنواعُ المواضيع (محاورها) لكلّ قسم.
 *
 * تضعها الإدارة، ويختار منها الأستاذ حين يقترح: اسمٌ، وحروفُ رمزٍ يُرقَّم بها
 * كلُّ موضوعٍ منها في القائمة الرسمية (AI01، AI02…)، ولونٌ فاتحٌ يُطبع خلف
 * سطره. ونوعٌ عليه مواضيع لا يُحذف — يُقال كم عليه، فتُنقل أوّلاً.
 */

type Draft = { name: string; code: string; color: string };
const CODE = /^[A-Za-z][A-Za-z0-9]{0,7}$/;
const blank = (i = 0): Draft => ({ name: "", code: "", color: TYPE_COLORS[i % TYPE_COLORS.length]! });

export function TopicTypesDialog({ departmentId: initial, onClose }: { departmentId?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: departments } = useDepartments();
  const [departmentId, setDepartmentId] = useState(initial ?? "");
  const dept = departmentId || departments?.[0]?.id || "";
  const typesQ = useTopicTypes(dept || undefined);
  const types = typesQ.data ?? [];
  const create = useCreateTopicType();
  const [draft, setDraft] = useState<Draft>(blank());
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const taken = (code: string, except?: string) => types.some((x) => x.id !== except && x.code.toLowerCase() === code.trim().toLowerCase());
  const valid = (d: Draft, except?: string) => !!d.name.trim() && CODE.test(d.code.trim()) && !taken(d.code, except);

  function add() {
    if (!dept || !valid(draft)) return;
    create.mutate(
      { departmentId: dept, name: draft.name.trim(), code: draft.code.trim(), color: draft.color },
      { onSuccess: () => setDraft(blank(types.length + 1)) },
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={t("topicTypes.title")}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-cream-card shadow-[0_24px_70px_rgba(0,0,0,0.4)] ring-1 ring-forest/10">
        <header className="forest-glow relative flex shrink-0 items-center gap-4 px-5 py-4 text-cream sm:px-6">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
          <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold-soft ring-1 ring-gold/30">
            <Tags size={20} />
          </span>
          <div className="relative min-w-0 flex-1">
            <h2 className="font-serif text-[18px] leading-tight font-bold text-cream">{t("topicTypes.title")}</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-cream/70">{t("topicTypes.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("topicTypes.close")}
            className="relative grid size-9 shrink-0 place-items-center rounded-xl text-cream/70 transition hover:bg-white/10 hover:text-cream"
          >
            <X size={18} />
          </button>
        </header>

        <div className="shrink-0 border-b border-forest/10 px-5 py-3.5 sm:px-6">
          <Select
            value={dept}
            onChange={(v) => {
              setDepartmentId(v);
              setEditing(null);
            }}
            icon={Building2}
            aria-label={t("topicTypes.department")}
            options={(departments ?? []).map((d: { id: string; name: string }) => ({ value: d.id, label: d.name }))}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {typesQ.isLoading ? (
            <LoadingArea className="py-14" />
          ) : !types.length ? (
            <p className="rounded-2xl border border-dashed border-forest/15 px-4 py-8 text-center text-[13px] text-clay" data-testid="topic-types-none">
              {t("topicTypes.none")}
            </p>
          ) : (
            <ul className="space-y-2" data-testid="topic-types-list">
              {types.map((x) =>
                editing === x.id ? (
                  <TypeEditor key={x.id} type={x} taken={(c) => taken(c, x.id)} valid={(d) => valid(d, x.id)} onDone={() => setEditing(null)} />
                ) : (
                  <TypeRow key={x.id} type={x} onEdit={() => setEditing(x.id)} />
                ),
              )}
            </ul>
          )}
        </div>

        {/* ── a new type ── */}
        <div className="shrink-0 space-y-3 border-t border-forest/10 bg-cream px-5 py-4 sm:px-6" data-testid="topic-type-new">
          <p className="text-[12px] font-bold text-forest">{t("topicTypes.add")}</p>
          <DraftFields draft={draft} onChange={setDraft} codeTaken={taken(draft.code)} />
          <div className="flex items-center justify-between gap-3">
            <Preview draft={draft} />
            <button
              type="button"
              onClick={add}
              disabled={!dept || !valid(draft) || create.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {create.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {t("topicTypes.addBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TypeRow({ type, onEdit }: { type: TopicTypeRow; onEdit: () => void }) {
  const { t } = useTranslation();
  const remove = useDeleteTopicType();
  const [confirm, setConfirm] = useState(false);
  const inUse = type.topicsCount > 0;
  return (
    <li
      className="flex items-center gap-3 rounded-2xl border border-forest/10 px-3.5 py-2.5"
      style={{ background: `linear-gradient(to left, ${type.color}55, transparent 60%)` }}
      data-testid="topic-type-row"
    >
      <span className="size-7 shrink-0 rounded-lg" style={{ background: type.color, boxShadow: `inset 0 0 0 1.5px ${deeper(type.color)}` }} />
      <span dir="ltr" className="w-14 shrink-0 font-mono text-[13px] font-bold text-forest">
        {type.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-forest">{type.name}</span>
      <span className="shrink-0 rounded-full bg-forest/6 px-2 py-0.5 text-[11px] text-clay tabular-nums">{t("topicTypes.count", { count: type.topicsCount })}</span>
      {confirm ? (
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => remove.mutate(type.id, { onSettled: () => setConfirm(false) })}
            disabled={remove.isPending}
            className="rounded-lg bg-brick px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-brick/90"
          >
            {t("topicTypes.confirmDelete")}
          </button>
          <button type="button" onClick={() => setConfirm(false)} aria-label={t("topicTypes.cancel")} className="grid size-7 place-items-center rounded-lg text-clay hover:bg-forest/5">
            <X size={14} />
          </button>
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={onEdit} aria-label={t("topicTypes.edit")} title={t("topicTypes.edit")} className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/8 hover:text-forest">
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={inUse}
            aria-label={t("topicTypes.delete")}
            title={inUse ? t("topicTypes.inUse", { count: type.topicsCount }) : t("topicTypes.delete")}
            className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-brick/10 hover:text-brick disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-clay"
          >
            <Trash2 size={15} />
          </button>
        </span>
      )}
    </li>
  );
}

function TypeEditor({ type, taken, valid, onDone }: { type: TopicTypeRow; taken: (c: string) => boolean; valid: (d: Draft) => boolean; onDone: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateTopicType();
  const [draft, setDraft] = useState<Draft>({ name: type.name, code: type.code, color: type.color });
  return (
    <li className="space-y-3 rounded-2xl border border-gold/40 bg-cream px-3.5 py-3" data-testid="topic-type-editor">
      <DraftFields draft={draft} onChange={setDraft} codeTaken={taken(draft.code)} />
      <div className="flex items-center justify-between gap-3">
        <Preview draft={draft} />
        <span className="flex items-center gap-1.5">
          <button type="button" onClick={onDone} className="rounded-xl border border-forest/15 px-3 py-2 text-[13px] text-clay transition hover:bg-forest/5">
            {t("topicTypes.cancel")}
          </button>
          <button
            type="button"
            disabled={!valid(draft) || update.isPending}
            onClick={() =>
              update.mutate({ id: type.id, data: { name: draft.name.trim(), code: draft.code.trim(), color: draft.color } }, { onSuccess: onDone })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-[13px] font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {t("topicTypes.save")}
          </button>
        </span>
      </div>
    </li>
  );
}

function DraftFields({ draft, onChange, codeTaken }: { draft: Draft; onChange: (d: Draft) => void; codeTaken: boolean }) {
  const { t } = useTranslation();
  const badCode = !!draft.code.trim() && !CODE.test(draft.code.trim());
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[1fr_7.5rem] gap-2">
        <input
          value={draft.name}
          maxLength={80}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder={t("topicTypes.namePlaceholder")}
          aria-label={t("topicTypes.name")}
          className={inputCls}
        />
        <input
          value={draft.code}
          maxLength={8}
          dir="ltr"
          onChange={(e) => onChange({ ...draft, code: e.target.value.replace(/\s/g, "") })}
          placeholder="AI"
          aria-label={t("topicTypes.code")}
          aria-invalid={badCode || codeTaken}
          className={`${inputCls} font-mono ${badCode || codeTaken ? "border-brick/60" : ""}`}
        />
      </div>
      {(badCode || codeTaken) && (
        <p className="text-[11px] text-brick">{codeTaken ? t("topicTypes.codeTaken") : t("topicTypes.codeRule")}</p>
      )}
      <div role="radiogroup" aria-label={t("topicTypes.color")} className="flex flex-wrap items-center gap-1.5">
        {TYPE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={draft.color === c}
            aria-label={c}
            onClick={() => onChange({ ...draft, color: c })}
            className={`size-7 rounded-lg transition ${draft.color === c ? "ring-2 ring-gold ring-offset-2 ring-offset-cream" : "hover:scale-110"}`}
            style={{ background: c, boxShadow: `inset 0 0 0 1.5px ${deeper(c)}` }}
          />
        ))}
        <label className="relative grid size-7 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-forest/25 text-clay" title={t("topicTypes.customColor")}>
          <Plus size={13} />
          <input
            type="color"
            value={draft.color}
            onChange={(e) => onChange({ ...draft, color: e.target.value })}
            aria-label={t("topicTypes.customColor")}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

function Preview({ draft }: { draft: Draft }) {
  if (!draft.name.trim() && !draft.code.trim()) return <span />;
  return <TopicTypeBadge type={{ id: "preview", name: draft.name.trim() || "…", code: `${draft.code.trim() || "…"}01`, color: draft.color }} />;
}
