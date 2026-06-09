import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Users, Pencil, Trash2, ListChecks } from "lucide-react";
import { LocaleLink } from "../../../i18n/locales/components/locale-link";
import { PATHS } from "../../../routes/paths";
import { useTopics, useDeleteTopic } from "../hooks/Professor-hook";
import { StatusBadge } from "../components/status-badge";
import { TopicFormDialog } from "../components/topic-form-dialog";
import type { Topic } from "../../../types/professor.types";

export function ProfessorTopicsPage() {
  const { t } = useTranslation();
  const { data: topics, isLoading } = useTopics();
  const del = useDeleteTopic();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (tp: Topic) => { setEditing(tp); setDialogOpen(true); };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-serif text-2xl font-bold text-forest">{t("dash.topics")}</h2>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-gold to-gold-soft px-4 py-2 text-sm font-bold text-forest-deep transition hover:-translate-y-px">
          <Plus size={16} /> {t("pro.newTopic")}
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-forest/5" />
          ))}
        </div>
      ) : !topics || topics.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-forest/15 bg-cream-card py-20 text-center">
          <ListChecks size={40} className="mb-3 text-forest/30" />
          <p className="mb-1 font-serif text-lg font-bold text-forest">{t("pro.noTopics")}</p>
          <p className="mb-4 text-sm text-clay">{t("pro.createFirst")}</p>
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-gold to-gold-soft px-4 py-2 text-sm font-bold text-forest-deep">
            <Plus size={16} /> {t("pro.newTopic")}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((tp) => {
            const canEdit = tp.status === "pending" || tp.status === "rejected";
            return (
              <div key={tp.id} className="group flex flex-col rounded-2xl border border-forest/10 bg-cream-card p-5 transition hover:shadow-lg hover:shadow-forest/5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <StatusBadge status={tp.status} />
                  <div className="flex items-center gap-1 text-[11px] text-clay">
                    <Users size={13} /> {tp._count?.applications ?? 0}
                  </div>
                </div>
                <h3 className="mb-1 line-clamp-2 font-serif text-base font-bold text-forest">{tp.title}</h3>
                <p className="mb-4 line-clamp-2 flex-1 text-[13px] leading-relaxed text-clay">{tp.description}</p>
                <div className="flex items-center gap-2 border-t border-forest/10 pt-3">
                  <LocaleLink to={`${PATHS.professor.root}/topics/${tp.id}`} className="flex-1 rounded-lg bg-forest/5 px-3 py-1.5 text-center text-[12px] font-medium text-forest transition hover:bg-forest/10">
                    {t("pro.viewApplications")}
                  </LocaleLink>
                  {canEdit && (
                    <>
                      <button onClick={() => openEdit(tp)} className="grid size-8 place-items-center rounded-lg text-forest/60 transition hover:bg-forest/5 hover:text-forest" title={t("pro.edit")}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => { if (confirm(t("pro.confirmDelete"))) del.mutate(tp.id); }} className="grid size-8 place-items-center rounded-lg text-red-500/60 transition hover:bg-red-500/5 hover:text-red-500" title={t("pro.delete")}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TopicFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} topic={editing} />
    </div>
  );
}