import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Users,
  Trash2,
  Crown,
  Loader2,
  Mail,
  IdCard,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { useProject, useRemoveProjectMember, useArchiveTopic, useDeleteTopic } from "../../../hooks/admin-hook";
import { useTranslation } from "react-i18next";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  open: boolean;
  groupId: string | null;
  topicId: string;
  topicTitle: string;
  onClose: () => void;
  /** Called after a change so the parent can refetch the topic. */
  onChanged?: () => void;
  /** Called after the topic itself is deleted (parent should navigate away). */
  onDeleted?: () => void;
}

function initials(first?: string | null, last?: string | null) {
  return (first?.[0] ?? "") + (last?.[0] ?? "") || "\u061f";
}
function fullName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || "\u2014";
}

export function ProjectMembersDialog({
  open,
  groupId,
  topicId,
  topicTitle,
  onClose,
  onChanged,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const { data: project, isLoading, refetch } = useProject(groupId);
  const remove = useRemoveProjectMember();
  const archive = useArchiveTopic();
  const del = useDeleteTopic();
  const [emptied, setEmptied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setEmptied(false);
  }, [open, groupId]);

  if (!open) return null;

  const members = (project?.members ?? []) as any[];
  const isEmpty = emptied || (!isLoading && members.length === 0);
  const busy = remove.isPending || archive.isPending || del.isPending;

  function onRemove(studentId: string) {
    if (!groupId) return;
    remove.mutate(
      { groupId, studentId },
      {
        onSuccess: (res: any) => {
          onChanged?.();
          if (res?.dissolved) setEmptied(true);
          else refetch();
        },
      },
    );
  }
  function onArchive() {
    archive.mutate(topicId, {
      onSuccess: () => {
        onChanged?.();
        onClose();
      },
    });
  }
  function onDelete() {
    del.mutate(topicId, { onSuccess: () => onDeleted?.() });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
      />

      <div className="animate-[fadeIn_0.15s_ease-out] relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-2xl">
        {/* header */}
        <div className="flex items-center gap-3 bg-linear-to-l from-forest to-forest-deep px-6 py-4 text-cream">
          <div className="grid size-9 place-items-center rounded-xl bg-cream/15">
            <Users size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-serif text-base font-bold">{t("admin.projectStudents")}</h3>
            <p className="truncate text-[11px] text-cream/70">{topicTitle}</p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            className="grid size-8 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* body */}
        <div className="max-h-[calc(90vh-8.5rem)] space-y-3 overflow-y-auto px-6 py-5">
          {isLoading && !isEmpty ? (
            <div className="grid place-items-center py-10 text-clay">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : isEmpty ? (
            <div className="grid place-items-center gap-2 py-8 text-center">
              <div className="grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                <Users size={26} />
              </div>
              <p className="text-sm font-semibold text-forest">{t("admin.noStudentsInProject")}</p>
              <p className="text-xs text-clay">{t("admin.topicNowApprovedHint")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  {t("admin.removeStudentsFirstHint")}
                </p>
              </div>

              {members.map((m) => {
                const u = m.student?.user;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-forest/10 bg-cream-2 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {u?.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="size-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid size-10 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                          {initials(u?.firstName, u?.lastName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                          {m.isLeader && (
                            <Crown size={13} className="text-gold" />
                          )}
                          {fullName(u)}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-clay">
                          <span
                            className="inline-flex items-center gap-1"
                            dir="ltr"
                          >
                            <IdCard size={11} />{" "}
                            {m.student?.registrationNumber ?? "\u2014"}
                          </span>
                          {u?.email && (
                            <span
                              className="inline-flex items-center gap-1"
                              dir="ltr"
                            >
                              <Mail size={11} /> {u.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(m.student.id)}
                      disabled={busy}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={13} />{t("admin.removeCover")}</button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-forest/10 px-6 py-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
          >{t("admin.close")}</button>
          {isEmpty && (
            <div className="flex items-center gap-2">
              <button
                onClick={onArchive}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-forest/20 px-4 py-2 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
              >
                <Archive size={15} />{t("admin.archive")}</button>
              <button
                onClick={onDelete}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 size={15} />{t("admin.deleteTopic")}</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
