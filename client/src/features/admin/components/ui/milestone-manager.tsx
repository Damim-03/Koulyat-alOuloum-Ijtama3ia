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
} from "lucide-react";

import {
  useGroupMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
} from "../../hooks/admin-hook";
import { statusChip } from "../../utils/status-styles";
import { ConfirmDialog } from "../form/confirm-dialog.form";
import i18n from "../../../../i18n/i18n";

/**
 * The project timeline, editable from the administration side.
 *
 * Milestones used to belong to the supervising professor alone. They are now
 * shared, so every write here notifies the supervisor server-side — a
 * timeline that two parties can change silently is worse than one owner.
 *
 * Searching and filtering happen on the loaded list rather than over the
 * network: a project has a handful of milestones, and a round trip per
 * keystroke would be slower and no more correct.
 */

const STATUSES = ["pending", "in_progress", "completed", "overdue"] as const;

const inputCls =
  "w-full rounded-xl border border-forest/15 bg-cream px-3 py-2 text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20";

function fmtDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(i18n.language, {
    dateStyle: "medium",
  });
}
/** `yyyy-mm-dd` for <input type="date">, which accepts nothing else. */
function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

interface Milestone {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  order: number;
  status: string;
  _count?: { submissions: number };
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

export function MilestoneManager({ groupId }: { groupId: string }) {
  const { t } = useTranslation();

  const [term, setTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Milestone | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useGroupMilestones(groupId);
  const create = useCreateMilestone();
  const update = useUpdateMilestone();
  const remove = useDeleteMilestone();

  const all = useMemo(() => (data ?? []) as Milestone[], [data]);

  const shown = useMemo(() => {
    const q = term.trim().toLowerCase();
    return all.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
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
          <Search
            className="absolute top-1/2 end-3 -translate-y-1/2 text-clay"
            size={15}
          />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={t("admin.searchMilestone")}
            className="w-full rounded-xl border border-forest/15 bg-cream py-2 pe-9 ps-3 text-sm text-forest outline-none transition focus:border-sage"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-forest/15 bg-cream px-3 py-2 text-sm text-forest outline-none transition focus:border-sage"
        >
          <option value="">{t("admin.allStatuses")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`, { defaultValue: s })}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft({ ...EMPTY });
          }}
          disabled={!!draft}
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
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              rows={2}
              placeholder={t("admin.milestoneDescPlaceholder")}
              className={`${inputCls} resize-y`}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-clay">
                  {t("admin.deadline")}
                </span>
                <input
                  type="date"
                  value={draft.deadline}
                  onChange={(e) =>
                    setDraft({ ...draft, deadline: e.target.value })
                  }
                  className={inputCls}
                  dir="ltr"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-clay">
                  {t("admin.currentStatus")}
                </span>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                  className={inputCls}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`, { defaultValue: s })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
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

      {/* list */}
      {isLoading ? (
        <div className="grid place-items-center py-8 text-clay">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-clay">
          {all.length === 0
            ? t("admin.noMilestonesYet")
            : t("admin.noMilestonesMatch")}
        </p>
      ) : (
        <ol className="space-y-3">
          {shown.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-xl border border-forest/10 bg-cream-2 p-3"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-forest/10 text-[11px] font-bold text-forest tabular-nums">
                {m.order}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-forest">{m.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusChip(m.status)}`}
                  >
                    {t(`status.${m.status}`, { defaultValue: m.status })}
                  </span>
                </div>
                {m.description && (
                  <p className="mt-1 text-[12px] leading-relaxed text-clay">
                    {m.description}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-clay">
                  <span className="inline-flex items-center gap-1">
                    <CalendarCheck size={11} />
                    {t("admin.deadline")}: {fmtDate(m.deadline)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText size={11} />
                    {t("admin.submissionsCount", {
                      n: m._count?.submissions ?? 0,
                    })}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
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
                  aria-label={t("admin.editMilestone")}
                  className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/10 hover:text-forest"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(m)}
                  aria-label={t("admin.deleteMilestone")}
                  className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 flex items-start gap-1.5 border-t border-forest/10 pt-3 text-[11px] leading-relaxed text-clay">
        <Info size={12} className="mt-0.5 shrink-0" />
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
