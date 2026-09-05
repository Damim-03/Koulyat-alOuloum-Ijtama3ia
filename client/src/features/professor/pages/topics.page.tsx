import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Pencil,
  Trash2,
  Info,
  Users2,
  FileText,
  ChevronLeft,
} from "lucide-react";
import { useMyTopics, useDeleteTopic } from "../hooks/Professor-hook";
import { TopicFormDialog } from "../components/topic-form-dialog";
import { StatusBadge } from "../components/status-badge";
import type { Topic } from "../../../types/professor.types";

export function ProfessorTopicsPage() {
  const { t } = useTranslation();
  const { data: topics, isLoading } = useMyTopics();
  const deleteTopic = useDeleteTopic();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);

  const list = topics ?? [];

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(tp: Topic) {
    setEditing(tp);
    setDialogOpen(true);
  }
  function handleDelete(tp: Topic) {
    if (confirm(t("pro.confirmDeleteTopic"))) deleteTopic.mutate(tp.id);
  }

  function editable(tp: Topic) {
    return tp.status === "pending" || tp.status === "rejected";
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-forest">
            {t("pro.myTopicsTitle")}
          </h1>
          <p className="mt-1 text-sm text-clay">{t("pro.myTopicsSubtitle")}</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft"
        >
          <Plus size={18} />
          {t("pro.sendNewTopic")}
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-20 text-center">
          <p className="mb-3 text-sm text-clay">{t("pro.noTopicsYet")}</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-cream transition hover:bg-forest-deep"
          >
            <Plus size={16} />
            {t("pro.createFirst")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((tp) => (
            <div
              key={tp.id}
              className="flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]"
            >
              {/* Status + rejection info */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={tp.status} />
                  {tp.status === "rejected" && tp.rejectionReason && (
                    <span className="group relative cursor-help text-red-400">
                      <Info size={14} />
                      <span className="pointer-events-none absolute right-0 top-6 z-10 hidden w-48 rounded-lg bg-forest-deep px-3 py-2 text-[11px] text-cream shadow-lg group-hover:block">
                        {tp.rejectionReason}
                      </span>
                    </span>
                  )}
                </div>
                {editable(tp) && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(tp)}
                      className="grid size-7 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(tp)}
                      className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="mb-2 font-serif text-base font-bold text-forest">
                {tp.title}
              </h3>

              {/* Meta */}
              <p className="mb-3 text-xs text-clay">
                {tp.specialization?.name ?? "\u2014"} ·{" "}
                {tp.academicYear?.title ?? "\u2014"}
              </p>

              {/* Counts */}
              <div className="mb-4 flex items-center justify-between border-t border-forest/10 pt-3 text-clay">
                <span className="flex items-center gap-1 text-xs">
                  <FileText size={14} />
                  {tp._count?.groupRequests ?? 0} {t("pro.applicationsShort")}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <Users2 size={14} />
                  {tp.maxStudents} {t("pro.studentsShort")}
                </span>
              </div>

              <Link
                to={`../topics/${tp.id}`}
                className="mt-auto flex items-center justify-center gap-1 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream transition hover:bg-forest-deep"
              >
                {t("pro.viewDetails")}
                <ChevronLeft size={14} className="ltr:rotate-180" />
              </Link>
            </div>
          ))}
        </div>
      )}

      <TopicFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        topic={editing}
      />
    </div>
  );
}
