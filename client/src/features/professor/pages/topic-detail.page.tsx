import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Pencil,
  Trash2,
  Check,
  X,
  ListChecks,
  Target,
  Users2,
  CalendarDays,
  Layers,
  AlertCircle,
} from "lucide-react";
import {
  useTopic,
  useDeleteTopic,
  useAcceptApplication,
  useRejectApplication,
} from "../hooks/Professor-hook";
import type { Application } from "../../../types/professor.types";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  open: "bg-sky-100 text-sky-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-200 text-gray-600",
  accepted: "bg-emerald-100 text-emerald-700",
};

function initials(first?: string | null, last?: string | null, fallback = "\u061f") {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

export function ProfessorTopicDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: topic, isLoading } = useTopic(id ?? null);
  const deleteTopic = useDeleteTopic();
  const acceptApp = useAcceptApplication();
  const rejectApp = useRejectApplication();

  const editable = topic?.status === "pending" || topic?.status === "rejected";

  function fmtDate(iso?: string) {
    if (!iso) return "\u2014";
    try {
      return new Intl.DateTimeFormat(i18n.language || "ar", { dateStyle: "medium" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }
  function studentName(a: Application) {
    const u = a.student?.user;
    return [u?.firstName, u?.lastName].filter(Boolean).join(" ") || a.student?.registrationNumber || "\u2014";
  }
  function handleDelete() {
    if (!topic) return;
    if (confirm(t("pro.confirmDeleteTopic"))) {
      deleteTopic.mutate(topic.id, { onSuccess: () => navigate(-1) });
    }
  }

  if (isLoading) {
    return <div className="py-20 text-center text-sm text-clay">{"\u2026"}</div>;
  }
  if (!topic) {
    return <div className="py-20 text-center text-sm text-clay">{t("pro.topicNotFound")}</div>;
  }

  const applications = topic.applications ?? [];

  return (
    <div className="font-body">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-clay transition hover:text-forest"
      >
        <ArrowRight size={16} className="ltr:rotate-180" />
        {t("pro.backToTopics")}
      </button>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`mt-1 rounded-full px-3 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[topic.status] ?? "bg-gray-100 text-gray-600"}`}>
            {t(`status.${topic.status}`, { defaultValue: topic.status })}
          </span>
          <h1 className="max-w-2xl font-serif text-2xl font-bold leading-snug text-forest">
            {topic.title}
          </h1>
        </div>

        {editable && (
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/20 px-3 py-2 text-xs font-semibold text-forest transition hover:bg-forest/5"
            >
              <Pencil size={14} />
              {t("pro.edit")}
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
            >
              <Trash2 size={14} />
              {t("pro.delete")}
            </button>
          </div>
        )}
      </div>

      {/* Rejection reason banner */}
      {topic.status === "rejected" && topic.rejectionReason && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-bold text-red-700">{t("pro.rejectionReasonTitle")}</p>
            <p className="text-sm text-red-600">{topic.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Description + requirements + objectives */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Description (full width on top) */}
        <div className="lg:col-span-2 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <h2 className="mb-2 font-serif text-base font-bold text-forest">{t("pro.projectDetails")}</h2>
          <p className="text-sm leading-relaxed text-clay">{topic.description}</p>
        </div>

        {/* Requirements */}
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-sm font-bold text-forest">
            <ListChecks size={16} className="text-gold" />
            {t("pro.requirements")}
          </h3>
          {(topic.requirements ?? []).length === 0 ? (
            <p className="text-xs text-clay">{t("pro.noRequirements")}</p>
          ) : (
            <ul className="space-y-1.5">
              {(topic.requirements ?? []).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-clay">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Objectives */}
        <div className="rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
          <h3 className="mb-3 flex items-center gap-2 font-serif text-sm font-bold text-forest">
            <Target size={16} className="text-sage" />
            {t("pro.objectives")}
          </h3>
          {(topic.objectives ?? []).length === 0 ? (
            <p className="text-xs text-clay">{t("pro.noObjectives")}</p>
          ) : (
            <ul className="space-y-1.5">
              {(topic.objectives ?? []).map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-clay">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sage" />
                  {o}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Meta strip */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetaTile icon={Layers} label={t("pro.statusLabel")} value={t(`status.${topic.status}`, { defaultValue: topic.status })} />
        <MetaTile icon={Users2} label={t("pro.maxStudents")} value={String(topic.maxStudents)} />
        <MetaTile icon={CalendarDays} label={t("pro.createdAt")} value={fmtDate(topic.createdAt)} />
        <MetaTile icon={Layers} label={t("pro.specialization")} value={topic.specialization?.name ?? "\u2014"} />
      </div>

      {/* Applications */}
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="border-b border-forest/10 px-5 py-4">
          <h2 className="font-serif text-lg font-bold text-forest">{t("pro.submittedApplications")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead>
              <tr className="bg-forest text-cream">
                <th className="px-5 py-3 text-xs font-medium">{t("pro.student")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.regNumber")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.priority")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.applicationDate")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.statusLabel")}</th>
                <th className="px-5 py-3 text-xs font-medium">{t("pro.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {applications.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-clay">{t("pro.noApplications")}</td></tr>
              )}

              {applications.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-forest/[0.03]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-xs font-bold text-cream">
                        {initials(a.student?.user?.firstName, a.student?.user?.lastName)}
                      </div>
                      <span className="text-sm font-medium text-forest">{studentName(a)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay" dir="ltr">{a.student?.registrationNumber ?? "\u2014"}</td>
                  <td className="px-5 py-3.5">
                    <span className="grid size-7 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold">
                      {a.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-clay">{fmtDate(a.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {t(`status.${a.status}`, { defaultValue: a.status })}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {a.status === "pending" ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => acceptApp.mutate(a.id)}
                          disabled={acceptApp.isPending}
                          className="grid size-8 place-items-center rounded-lg text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40"
                          title={t("pro.accept")}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => rejectApp.mutate(a.id)}
                          disabled={rejectApp.isPending}
                          className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                          title={t("pro.reject")}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-clay">{"\u2014"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetaTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-card p-4 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className="grid size-10 place-items-center rounded-full bg-soft-sage/30 text-forest">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-clay">{label}</p>
        <p className="truncate font-serif text-sm font-bold text-forest">{value}</p>
      </div>
    </div>
  );
}