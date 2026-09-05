import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  X,
  Users,
  Trash2,
  SendHorizontal,
  Star,
  Loader2,
  Mail,
  IdCard,
  Archive,
  AlertTriangle,
  Search,
  UserPlus,
  Save,
  Undo2,
} from "lucide-react";

import {
  useProject,
  useRemoveProjectMember,
  useArchiveTopic,
  useDeleteTopic,
  useStudents,
  useUpdateAssignedTopic,
} from "../../../hooks/admin-hook";
import { UserAvatar } from "../../ui/user-avatar";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Group membership editor.
 *
 * The previous version could only *remove* people, one at a time and
 * immediately — there was no way to swap a student in, and no way to change
 * the leader at all. Editing is now staged: add, remove and re-crown freely,
 * then save once. The roster is written through the existing
 * `PATCH /topics/:id/assignment`, so its guards still apply (capacity, leader
 * must be a member, a student cannot belong to two projects).
 *
 * Emptying the group stays a separate act: that endpoint requires at least one
 * member, and dissolving a project is not the same thing as editing it.
 */

interface Props {
  open: boolean;
  groupId: string | null;
  topicId: string;
  topicTitle: string;
  /** Capacity, so the editor can stop before the server has to. */
  maxStudents?: number;
  /** Scopes the search to the topic's own specialization when known. */
  specializationId?: string | null;
  onClose: () => void;
  /** Called after a change so the parent can refetch the topic. */
  onChanged?: () => void;
  /** Called after the topic itself is deleted (parent should navigate away). */
  onDeleted?: () => void;
}

interface Row {
  studentId: string;
  name: string;
  reg: string;
  email?: string | null;
  user: any;
}

function fullName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "—";
}

export function ProjectMembersDialog(props: Props) {
  const { open, groupId } = props;
  const { data: project, isLoading, refetch } = useProject(groupId);

  if (!open) return null;

  // The editor mounts only once the roster has arrived, so its state comes
  // from `useState` initialisers rather than an effect that syncs after the
  // fact — and a background refetch can never discard an edit in progress.
  // Keying on the group guarantees a clean slate for a different project.
  return createPortal(
    <Shell topicTitle={props.topicTitle} onClose={props.onClose}>
      {isLoading ? (
        <div className="grid place-items-center py-16 text-clay">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <MembersEditor
          key={groupId ?? "none"}
          {...props}
          serverMembers={(project?.members ?? []) as any[]}
          refetchProject={refetch}
        />
      )}
    </Shell>,
    document.body,
  );
}

/** Chrome that does not depend on the roster: backdrop, card and header. */
function Shell({
  topicTitle,
  onClose,
  children,
}: {
  topicTitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-60 grid place-items-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
      />
      <div className="animate-[fadeIn_0.15s_ease-out] relative flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-2xl">
        <div className="flex shrink-0 items-center gap-3 bg-linear-to-l from-forest to-forest-deep px-6 py-4 text-cream">
          <div className="grid size-10 place-items-center rounded-xl bg-cream/15">
            <Users size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-base font-bold">
              {t("admin.manageMembersTitle")}
            </h3>
            <p className="truncate text-[11px] text-cream/70">{topicTitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("admin.close")}
            className="grid size-8 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/10"
          >
            <X size={16} />
          </button>
        </div>
        {/* The editor supplies a scrolling body and a fixed footer; this
            contents wrapper lets them participate in the card's flex
            column instead of forming a block of their own. */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function MembersEditor({
  groupId,
  topicId,
  maxStudents = 10,
  specializationId,
  onClose,
  onChanged,
  onDeleted,
  serverMembers,
  refetchProject,
}: Props & { serverMembers: any[]; refetchProject: () => void }) {
  const { t } = useTranslation();
  const remove = useRemoveProjectMember();
  const archive = useArchiveTopic();
  const del = useDeleteTopic();
  const updateTopic = useUpdateAssignedTopic();

  const [rows, setRows] = useState<Row[]>(() =>
    serverMembers.map((m) => ({
      studentId: m.student?.id,
      name: fullName(m.student?.user),
      reg: m.student?.registrationNumber ?? "",
      email: m.student?.user?.email,
      user: m.student?.user,
    })),
  );
  const [leaderId, setLeaderId] = useState<string>(
    () => serverMembers.find((m) => m.isLeader)?.student?.id ?? "",
  );
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [emptied, setEmptied] = useState(false);
  const [confirmDissolve, setConfirmDissolve] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(id);
  }, [term]);

  const { data: found, isFetching: searching } = useStudents(
    debounced
      ? {
          page: 1,
          limit: 8,
          quickSearch: debounced,
          specializationId: specializationId || undefined,
        }
      : undefined,
  );
  const results = ((found?.items ?? []) as any[]).filter(
    (s) => !rows.some((r) => r.studentId === s.id),
  );

  const original = useMemo(
    () => ({
      ids: serverMembers
        .map((m) => m.student?.id)
        .filter(Boolean)
        .sort()
        .join(","),
      leader: serverMembers.find((m) => m.isLeader)?.student?.id ?? "",
    }),
    [serverMembers],
  );
  const dirty =
    rows
      .map((r) => r.studentId)
      .sort()
      .join(",") !== original.ids || leaderId !== original.leader;

  const busy =
    remove.isPending ||
    archive.isPending ||
    del.isPending ||
    updateTopic.isPending;
  const isEmpty = emptied || serverMembers.length === 0;
  const atCapacity = rows.length >= maxStudents;

  function add(s: any) {
    if (atCapacity) return;
    setRows((prev) => [
      ...prev,
      {
        studentId: s.id,
        name: fullName(s.user),
        reg: s.registrationNumber ?? "",
        email: s.user?.email,
        user: s.user,
      },
    ]);
    setLeaderId((cur) => cur || s.id);
    setTerm("");
    setError(null);
  }

  function drop(studentId: string) {
    const next = rows.filter((r) => r.studentId !== studentId);
    setRows(next);
    if (leaderId === studentId) setLeaderId(next[0]?.studentId ?? "");
  }

  function save() {
    setError(null);
    if (rows.length === 0) {
      setError(t("admin.needOneMember"));
      return;
    }
    updateTopic.mutate(
      {
        id: topicId,
        data: {
          memberStudentIds: rows.map((r) => r.studentId),
          leaderStudentId: leaderId || rows[0].studentId,
        },
      },
      {
        onSuccess: () => {
          onChanged?.();
          onClose();
        },
        onError: (e: any) =>
          setError(e?.response?.data?.message ?? e?.message ?? "—"),
      },
    );
  }

  /** Removes every member; the server dissolves the group on the last one. */
  async function dissolve() {
    if (!groupId) return;
    setError(null);
    for (const m of serverMembers) {
      try {
        await remove.mutateAsync({ groupId, studentId: m.student.id });
      } catch {
        // keep going; whatever survives is reflected on the next refetch
      }
    }
    setEmptied(true);
    setRows([]);
    setConfirmDissolve(false);
    onChanged?.();
    refetchProject();
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {isEmpty ? (
          <div className="grid place-items-center gap-2 py-10 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <Users size={26} />
            </div>
            <p className="text-sm font-semibold text-forest">
              {t("admin.noStudentsInProject")}
            </p>
            <p className="text-xs text-clay">
              {t("admin.topicNowApprovedHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* ── current roster ── */}
            <section className="rounded-2xl border border-forest/10 bg-cream p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                  <Users size={16} />
                  {t("admin.currentMembers")}
                </p>
                <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums">
                  {rows.length} / {maxStudents}
                </span>
              </div>

              {rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-forest/15 px-3 py-8 text-center text-xs leading-relaxed text-clay">
                  {t("admin.needOneMember")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {rows.map((r) => {
                    const isLeader = leaderId === r.studentId;
                    return (
                      <div
                        key={r.studentId}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                          isLeader
                            ? "border-gold bg-gold/5"
                            : "border-forest/10 bg-cream-card"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setLeaderId(r.studentId)}
                            title={t("admin.setLeader")}
                            className={`grid size-7 shrink-0 place-items-center rounded-lg transition ${
                              isLeader
                                ? "bg-gold/20 text-gold"
                                : "text-clay hover:bg-forest/5 hover:text-gold"
                            }`}
                          >
                            {isLeader ? (
                              <SendHorizontal size={15} />
                            ) : (
                              <Star size={15} />
                            )}
                          </button>
                          <UserAvatar user={r.user} size={36} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-forest">
                              {r.name}
                              {isLeader && (
                                <span className="ms-1.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                                  {t("admin.leader")}
                                </span>
                              )}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-clay">
                              <span
                                className="inline-flex items-center gap-1"
                                dir="ltr"
                              >
                                <IdCard size={11} /> {r.reg || "—"}
                              </span>
                              {r.email && (
                                <span
                                  className="inline-flex items-center gap-1 truncate"
                                  dir="ltr"
                                >
                                  <Mail size={11} /> {r.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => drop(r.studentId)}
                          disabled={busy}
                          aria-label={t("admin.removeCover")}
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── add ── */}
            <section className="rounded-2xl border border-forest/10 bg-cream p-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-forest">
                <UserPlus size={16} />
                {t("admin.addStudent")}
              </p>

              <div className="relative">
                <Search
                  className="absolute top-1/2 end-3 -translate-y-1/2 text-clay"
                  size={16}
                />
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  disabled={atCapacity}
                  placeholder={t("admin.searchStudentAny")}
                  className="w-full rounded-xl border border-forest/15 bg-cream-card py-2.5 pe-9 ps-3 text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20 disabled:opacity-50"
                />
              </div>

              {atCapacity && (
                <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                  {t("admin.groupFullHint")}
                </p>
              )}

              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-forest/10 bg-cream-card">
                {!debounced ? (
                  <p className="px-3 py-8 text-center text-xs text-clay">
                    {t("admin.searchToAdd")}
                  </p>
                ) : searching ? (
                  <p className="px-3 py-8 text-center text-xs text-clay">
                    {"…"}
                  </p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-8 text-center text-xs text-clay">
                    {t("admin.noSearchResults")}
                  </p>
                ) : (
                  results.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => add(s)}
                      disabled={atCapacity}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start transition hover:bg-forest/5 disabled:opacity-50"
                    >
                      <UserAvatar user={s.user} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-forest">
                          {fullName(s.user)}
                        </span>
                        <span
                          className="block truncate text-[11px] text-clay"
                          dir="ltr"
                        >
                          {s.registrationNumber}
                        </span>
                      </span>
                      <UserPlus size={15} className="shrink-0 text-sage" />
                    </button>
                  ))
                )}
              </div>

              <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-clay">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {t("admin.removeStudentsFirstHint")}
              </p>
            </section>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {confirmDissolve && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-300">
              {t("admin.dissolveGroupConfirm")}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={dissolve}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                {t("admin.dissolveGroup")}
              </button>
              <button
                onClick={() => setConfirmDissolve(false)}
                className="rounded-lg border border-forest/20 px-3.5 py-2 text-xs font-medium text-clay transition hover:bg-forest/5"
              >
                {t("admin.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── footer ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-forest/10 bg-cream-card px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
          >
            {t("admin.close")}
          </button>
          {dirty && !isEmpty && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <Undo2 size={12} />
              {t("admin.unsavedChanges")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEmpty ? (
            <>
              <button
                onClick={() =>
                  archive.mutate(topicId, {
                    onSuccess: () => {
                      onChanged?.();
                      onClose();
                    },
                  })
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
              >
                <Archive size={15} />
                {t("admin.archive")}
              </button>
              <button
                onClick={() =>
                  del.mutate(topicId, { onSuccess: () => onDeleted?.() })
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 size={15} />
                {t("admin.deleteTopic")}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDissolve(true)}
                disabled={busy || confirmDissolve}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-60"
              >
                <Trash2 size={15} />
                {t("admin.dissolveGroup")}
              </button>
              <button
                onClick={save}
                disabled={busy || !dirty || rows.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateTopic.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                {t("admin.saveMembers")}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
