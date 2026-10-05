import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Save,
  Loader2,
  CalendarCheck,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
  Download,
  Clock,
} from "lucide-react";

import {
  useGroupMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
} from "../../hooks/admin-hook";
import { ConfirmDialog } from "../form/confirm-dialog.form";
import i18n from "../../../../i18n/i18n";
import { noneText } from "../../../../lib/none-text";
import { Select } from "../../../../components/ui/select";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { UserAvatar } from "../../../../components/ui/user-avatar";
import type { AdminSubmission } from "../../../../types/admin";
import { personName } from "../../../../lib/person-name";

/**
 * The project timeline, editable from the administration side.
 *
 * Milestones used to belong to the supervising professor alone. They are now
 * shared, so every write here notifies the supervisor server-side — a
 * timeline that two parties can change silently is worse than one owner.
 *
 * "Late" follows the rule of the professor and student spaces: past its date
 * and not completed, whatever its flag says. The flag alone let a milestone
 * nobody updated sit as "pending" weeks after its deadline.
 *
 * Searching and filtering happen on the loaded list rather than over the
 * network: a project has a handful of milestones, and a round trip per
 * keystroke would be slower and no more correct.
 */

const STATUSES = ["pending", "in_progress", "completed", "overdue"] as const;

const inputCls =
  "w-full rounded-xl border border-forest/15 bg-cream px-3 py-2 text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20";

function fmtDate(value?: string | Date | null) {
  if (!value) return noneText();
  return new Date(value).toLocaleDateString(i18n.language, {
    dateStyle: "medium",
  });
}
function fmtDateTime(value: string) {
  return new Date(value).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });
}
/** `yyyy-mm-dd` for <input type="date">, which accepts nothing else. */
function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function daysLeft(value: string) {
  const d = new Date(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - start.getTime()) / 86_400_000);
}
function size(bytes?: number | null) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  order: number;
  status: string;
  _count?: { submissions: number };
  submissions?: AdminSubmission[];
}

interface Draft {
  id?: string;
  title: string;
  description: string;
  deadline: string;
  status: string;
}

const EMPTY: Draft = {
  title: "",
  description: "",
  deadline: "",
  status: "pending",
};

const late = (m: Milestone) =>
  m.status !== "completed" && (m.status === "overdue" || daysLeft(m.deadline) < 0);

type Kind = "completed" | "in_progress" | "late" | "pending";

/**
 * One colour per state, carried by the frame, the dot and the status pill
 * alike, so a milestone's state reads from across the page. Every tint is a
 * translucent hue with a dark-theme text shade, so it holds in both themes.
 */
const KIND: Record<Kind, { card: string; dot: string; pill: string }> = {
  completed: {
    card: "border-emerald-500/35 border-s-emerald-500 bg-emerald-500/[0.06]",
    dot: "border-emerald-500 bg-emerald-500 text-white",
    pill: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300",
  },
  in_progress: {
    card: "border-sky-500/35 border-s-sky-500 bg-sky-500/[0.06]",
    dot: "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    pill: "bg-sky-500/15 text-sky-700 ring-sky-500/30 dark:text-sky-300",
  },
  late: {
    card: "border-red-500/40 border-s-red-500 bg-red-500/[0.06]",
    dot: "border-red-500 bg-red-500/15 text-red-600 dark:text-red-300",
    pill: "bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-300",
  },
  pending: {
    card: "border-amber-500/35 border-s-amber-500 bg-amber-500/[0.05]",
    dot: "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    pill: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300",
  },
};

/** A small fact under the title — a pill, legible at a glance. */
const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-forest/10 bg-cream-card/80 px-2.5 py-1 text-[12px] text-forest/85";

export function MilestoneManager({ groupId }: { groupId: string }) {
  const { t } = useTranslation();

  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Milestone | null>(null);
  const [openFiles, setOpenFiles] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useGroupMilestones(groupId);
  const create = useCreateMilestone();
  const update = useUpdateMilestone();
  const remove = useDeleteMilestone();

  const all = useMemo(() => (data ?? []) as Milestone[], [data]);

  const shown = useMemo(() => {
    const q = term.trim().toLowerCase();
    return all.filter((m) => {
      // "Late" is filtered by the same rule it is displayed by.
      if (statusFilter === "overdue" && !late(m)) return false;
      if (statusFilter && statusFilter !== "overdue" && (m.status !== statusFilter || late(m))) return false;
      if (!q) return true;
      return (
        String(m.title ?? "").toLowerCase().includes(q) ||
        String(m.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, term, statusFilter]);

  const busy = create.isPending || update.isPending || remove.isPending;
  const pendingSubmissions = confirmDelete?._count?.submissions ?? 0;

  function save() {
    if (!draft) return;
    if (!draft.title.trim() || !draft.deadline) {
      setError(t("admin.completeStepFirst"));
      return;
    }
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      deadline: draft.deadline,
      status: draft.status,
    };
    const done = { onSuccess: () => setDraft(null) };

    if (draft.id) update.mutate({ id: draft.id, data: payload }, done);
    else create.mutate({ groupId, data: payload }, done);
  }

  return (
    <div>
      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-1/2 end-3 -translate-y-1/2 text-clay" size={15} />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("admin.searchMilestone")}
            className="w-full rounded-xl border border-forest/15 bg-cream py-2 pe-9 ps-3 text-sm text-forest outline-none transition focus:border-sage"
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { value: "", label: t("admin.allStatuses") },
            ...STATUSES.map((s) => ({ value: s, label: t(`status.${s}`, { defaultValue: s }) })),
          ]}
        />

        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft({ ...EMPTY });
          }}
          disabled={!!draft}
          data-testid="milestone-add"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-50"
        >
          <Plus size={15} />
          {t("admin.addMilestone")}
        </button>
      </div>

      {/* editor */}
      {draft && (
        <div className="mb-4 rounded-2xl border border-gold/30 bg-gold/5 p-4">
          <p className="mb-3 text-sm font-semibold text-forest">
            {draft.id ? t("admin.editMilestone") : t("admin.addMilestone")}
          </p>

          <div className="space-y-3">
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={t("admin.milestoneTitlePlaceholder")}
              className={inputCls}
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={2}
              placeholder={t("admin.milestoneDescPlaceholder")}
              className={`${inputCls} resize-y`}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-clay">{t("admin.deadline")}</span>
                <input
                  type="date"
                  value={draft.deadline}
                  onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
                  className={inputCls}
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-clay">{t("admin.currentStatus")}</span>
                <Select
                  value={draft.status}
                  onChange={(v) => setDraft({ ...draft, status: v })}
                  options={STATUSES.map((s) => ({ value: s, label: t(`status.${s}`, { defaultValue: s }) }))}
                />
              </label>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t("admin.saveChanges")}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setDraft(null);
              }}
              className="rounded-xl border border-forest/20 px-4 py-2 text-xs font-medium text-clay transition hover:bg-forest/5"
            >
              {t("admin.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* timeline */}
      {isLoading ? (
        <LoadingArea size={80} className="py-8" />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-forest/15 py-10 text-center text-sm text-clay">
          {all.length === 0 ? t("admin.noMilestonesYet") : t("admin.noMilestonesMatch")}
        </p>
      ) : (
        <ol className="relative space-y-3.5" data-testid="milestone-timeline">
          {/* the spine */}
          <span className="absolute top-5 bottom-5 start-[17px] w-0.5 rounded-full bg-forest/10" aria-hidden />
          {shown.map((m) => {
            const isLate = late(m);
            const kind: Kind =
              m.status === "completed" ? "completed" : isLate ? "late" : m.status === "in_progress" ? "in_progress" : "pending";
            const look = KIND[kind];
            const days = daysLeft(m.deadline);
            const files = m.submissions ?? [];
            const count = m._count?.submissions ?? files.length;
            const filesOpen = openFiles === m.id;

            return (
              <li key={m.id} className="relative flex items-start gap-3" data-testid="milestone-item" data-kind={kind}>
                <span
                  className={`relative z-10 mt-3 grid size-9 shrink-0 place-items-center rounded-full border-2 text-[12.5px] font-bold tabular-nums shadow-sm ${look.dot}`}
                >
                  {m.status === "completed" ? <CheckCircle2 size={17} /> : m.order}
                </span>

                <div className={`min-w-0 flex-1 rounded-2xl border border-s-4 p-4 transition ${look.card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-bold text-forest">{m.title}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${look.pill}`}>
                          {t(`status.${isLate ? "overdue" : m.status}`, { defaultValue: m.status })}
                        </span>
                        {isLate && m.status !== "overdue" && (
                          <span
                            className="text-[11.5px] font-medium text-red-600 dark:text-red-300"
                            title={t("admin.proj.ms.lateByDateHint")}
                          >
                            {t("admin.proj.ms.lateByDate")}
                          </span>
                        )}
                      </div>
                      {m.description && (
                        <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line text-forest/75">{m.description}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {m.status !== "completed" && (
                        <button
                          type="button"
                          onClick={() => update.mutate({ id: m.id, data: { status: "completed" } })}
                          disabled={busy}
                          title={t("admin.proj.ms.markDone")}
                          aria-label={t("admin.proj.ms.markDone")}
                          className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-emerald-500/15 hover:text-emerald-600 disabled:opacity-40 dark:hover:text-emerald-300"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setDraft({
                            id: m.id,
                            title: m.title ?? "",
                            description: m.description ?? "",
                            deadline: toDateInput(m.deadline),
                            status: m.status ?? "pending",
                          });
                        }}
                        title={t("admin.editMilestone")}
                        aria-label={t("admin.editMilestone")}
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/10 hover:text-forest"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(m)}
                        title={t("admin.deleteMilestone")}
                        aria-label={t("admin.deleteMilestone")}
                        className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={PILL}>
                      <CalendarCheck size={13} className="text-clay" />
                      <span className="text-clay">{t("admin.deadline")}:</span>
                      <span className="font-semibold">{fmtDate(m.deadline)}</span>
                    </span>
                    {m.status !== "completed" && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ${
                          days < 0 ? KIND.late.pill : days <= 3 ? KIND.pending.pill : KIND.in_progress.pill
                        }`}
                      >
                        <Clock size={13} />
                        {days < 0
                          ? t("admin.proj.ms.daysAgo", { n: -days })
                          : days === 0
                            ? t("admin.proj.ms.today")
                            : t("admin.proj.ms.daysLeft", { n: days })}
                      </span>
                    )}
                    {count > 0 ? (
                      <button
                        type="button"
                        onClick={() => setOpenFiles(filesOpen ? null : m.id)}
                        aria-expanded={filesOpen}
                        className={`${PILL} font-semibold transition hover:border-gold/50 hover:bg-gold/10`}
                      >
                        <FileText size={13} className="text-gold" />
                        {t("admin.submissionsCount", { n: count })}
                        <ChevronDown size={13} className={`transition-transform ${filesOpen ? "rotate-180" : ""}`} />
                      </button>
                    ) : (
                      <span className={`${PILL} text-clay`}>
                        <FileText size={13} className="text-clay" />
                        {t("admin.proj.ms.noFiles")}
                      </span>
                    )}
                  </div>

                  {filesOpen && files.length > 0 && (
                    <ul className="mt-3 space-y-2 border-t border-forest/10 pt-3" data-testid="milestone-files">
                      {files.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-3 rounded-xl border border-forest/10 bg-cream-card px-3 py-2.5"
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
                            <FileText size={15} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-forest" dir="auto">
                              {f.fileName}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11.5px] text-clay">
                              <span className="font-semibold">v{f.version}</span>
                              {size(f.fileSize) && <span dir="ltr">{size(f.fileSize)}</span>}
                              <span>{fmtDateTime(f.createdAt)}</span>
                              {f.uploadedBy && (
                                <span className="inline-flex items-center gap-1">
                                  <UserAvatar user={f.uploadedBy} size={16} />
                                  {personName(f.uploadedBy)}
                                </span>
                              )}
                            </p>
                          </div>
                          <a
                            href={f.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t("admin.proj.ms.openFile")}
                            title={t("admin.proj.ms.openFile")}
                            className="grid size-8 shrink-0 place-items-center rounded-lg border border-forest/10 text-clay transition hover:border-gold/50 hover:bg-gold/10 hover:text-forest"
                          >
                            <Download size={15} />
                          </a>
                        </li>
                      ))}
                      {count > files.length && (
                        <li className="px-1 text-[11.5px] text-clay">
                          {t("admin.proj.ms.moreFiles", { n: count - files.length })}
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 flex items-start gap-1.5 border-t border-forest/10 pt-3 text-[12px] leading-relaxed text-clay">
        <Info size={13} className="mt-0.5 shrink-0" />
        {t("admin.milestoneSharedNote")}
      </p>

      <ConfirmDialog
        open={!!confirmDelete}
        tone="danger"
        title={t("admin.deleteMilestone")}
        message={t("admin.deleteMilestoneConfirm", {
          title: confirmDelete?.title ?? "",
        })}
        confirmLabel={t("admin.confirmDelete")}
        cancelLabel={t("admin.cancel")}
        loading={remove.isPending}
        onConfirm={() => {
          // The dialog stays mounted while the mutation runs, so this handler
          // can outlive the row it was opened for.
          if (!confirmDelete) return;
          remove.mutate(confirmDelete.id, {
            // The server refuses when submissions exist; keep the row and let
            // the toast carry the reason rather than pretending it worked.
            onSettled: () => setConfirmDelete(null),
          });
        }}
        onClose={() => setConfirmDelete(null)}
      >
        {pendingSubmissions > 0 && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {t("admin.submissionsCount", { n: pendingSubmissions })}
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
