import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Subtitles,
  ListChecks,
  Flag,
  Link2,
  FileText,
  Gavel,
  Check,
  X,
  ExternalLink,
  CheckCircle2,
  Users,
} from "lucide-react";
import {
  useAdminTopic,
  useApproveTopic,
  useRejectTopic,
} from "../hooks/admin-hook";

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  open: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  full: "bg-violet-100 text-violet-700",
  archived: "bg-gray-200 text-gray-600",
};

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  const a = (first?.[0] ?? "") + (last?.[0] ?? "");
  return a || fallback;
}

type TopicReference = { title: string; url: string };

export function AdminTopicDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = "", lang } = useParams();

  // Build the topics-list path WITH the current language prefix so we
  // always return to /<lang>/admin/topics (not the admin dashboard).
  const topicsPath = `/${lang}/admin/topics`;

  // NOTE: create useAdminTopic(id) in admin-hook.ts → GET /admin/topics/:id
  const { data: topic, isLoading } = useAdminTopic(id);
  const approve = useApproveTopic();
  const reject = useRejectTopic();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function fmtDate(iso?: string) {
    if (!iso) return "\u2014";
    try {
      return new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(
        new Date(iso),
      );
    } catch {
      return iso;
    }
  }

  if (isLoading) {
    return (
      <div className="font-body py-20 text-center text-sm text-clay">
        {"\u2026"}
      </div>
    );
  }
  if (!topic) {
    return (
      <div className="font-body py-20 text-center text-sm text-clay">
        {t("admin.noTopics")}
      </div>
    );
  }

  const u = topic.professor?.user;
  const profName =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
    topic.professor?.universityEmail ||
    "\u2014";
  const requirements: string[] = topic.requirements ?? [];
  const objectives: string[] = topic.objectives ?? [];
  const references: TopicReference[] =
    (topic.references as TopicReference[]) ?? [];
  const isPending = topic.status === "pending";

  function doApprove() {
    approve.mutate(topic!.id, { onSuccess: () => navigate(topicsPath) });
  }
  function doReject() {
    reject.mutate(
      { id: topic!.id, reason: reason || undefined },
      { onSuccess: () => navigate(topicsPath) },
    );
  }

  return (
    <div className="font-body">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={() => navigate(topicsPath)}
          className="inline-flex items-center gap-2 font-serif text-sm font-bold text-forest transition hover:opacity-80"
        >
          <ChevronRight size={18} />
          {t("admin.backToTopics")}
        </button>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold ${STATUS_STYLES[topic.status] ?? "bg-gray-100 text-gray-600"}`}
        >
          {t(`status.${topic.status}`, { defaultValue: topic.status })}
        </span>
      </div>

      {/* Hero header card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-4">
            <h1 className="max-w-3xl font-serif text-2xl font-bold leading-tight text-forest lg:text-3xl">
              {topic.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-soft-sage/30 px-3 py-1 text-[11px] font-medium text-forest">
                {topic.specialization?.name ?? "\u2014"}
              </span>
              <span className="rounded-full bg-forest/5 px-3 py-1 text-[11px] font-medium text-clay">
                {topic.academicYear?.title ?? "\u2014"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-gold">
                <Users size={14} />
                {t("admin.maxStudentsN", { n: topic.maxStudents })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-forest/10 bg-cream-2 p-4">
            <div className="text-right">
              <h4 className="text-sm font-bold text-forest">{profName}</h4>
              <p className="text-[11px] text-clay">{t("admin.supervisor")}</p>
            </div>
            <div className="grid size-12 place-items-center rounded-xl bg-linear-to-br from-forest to-forest-deep text-sm font-bold text-cream">
              {initials(u?.firstName, u?.lastName)}
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Left column (wide) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
              <Subtitles size={18} className="text-gold" />
              <h2 className="font-serif text-lg font-bold text-forest">
                {t("admin.topicDescriptionLabel")}
              </h2>
            </div>
            <p className="whitespace-pre-line leading-relaxed text-clay">
              {topic.description || "\u2014"}
            </p>
          </section>

          {/* Requirements */}
          {requirements.length > 0 && (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-5 flex items-center gap-2 border-b border-forest/10 pb-3">
                <ListChecks size={18} className="text-gold" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.requirementsLabel")}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {requirements.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg bg-cream-2 p-3 transition hover:bg-forest/5"
                  >
                    <CheckCircle2 size={18} className="shrink-0 text-sage" />
                    <span className="text-sm font-medium text-forest">{r}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Objectives */}
          {objectives.length > 0 && (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-5 flex items-center gap-2 border-b border-forest/10 pb-3">
                <Flag size={18} className="text-gold" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.objectivesLabel")}
                </h2>
              </div>
              <ul className="space-y-4">
                {objectives.map((o, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest/10 font-bold text-forest">
                      {i + 1}
                    </span>
                    <p className="pt-1 text-sm text-clay">{o}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* References */}
          {references.length > 0 && (
            <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
              <div className="mb-5 flex items-center gap-2 border-b border-forest/10 pb-3">
                <Link2 size={18} className="text-gold" />
                <h2 className="font-serif text-lg font-bold text-forest">
                  {t("admin.referencesLabel")}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {references.map((ref, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-forest/15 p-4 transition hover:bg-cream-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText size={18} className="shrink-0 text-clay" />
                      <p className="truncate text-sm font-medium text-forest">
                        {ref.title}
                      </p>
                    </div>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      dir="ltr"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-forest/20 px-3 py-1 text-[11px] font-bold text-forest transition hover:bg-forest/5"
                    >
                      <ExternalLink size={12} />
                      {t("admin.openLink")}
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right column (sidebar) */}
        <div className="space-y-6">
          {/* Summary info */}
          <div className="relative overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="absolute right-0 top-0 h-full w-1.5 bg-gold" />
            <h3 className="mb-6 font-serif text-lg font-bold text-forest">
              {t("admin.topicInfo")}
            </h3>
            <div className="space-y-1">
              <InfoRow
                label={t("admin.specialization")}
                value={topic.specialization?.name ?? "\u2014"}
              />
              <InfoRow
                label={t("admin.academicYear")}
                value={topic.academicYear?.title ?? "\u2014"}
              />
              <InfoRow
                label={t("admin.maxCapacity")}
                value={t("admin.maxStudentsN", { n: topic.maxStudents })}
              />
              <InfoRow
                label={t("admin.createdAt")}
                value={fmtDate(topic.createdAt)}
                last
              />
            </div>
          </div>

          {/* Decision card */}
          <div className="rounded-2xl border-2 border-forest/10 bg-cream-card p-6 shadow-[0_8px_30px_rgba(38,66,61,0.08)]">
            <h3 className="mb-6 flex items-center gap-2 font-serif text-lg font-bold text-forest">
              <Gavel size={18} />
              {t("admin.adminAction")}
            </h3>

            {isPending ? (
              <div className="space-y-3">
                {!rejecting ? (
                  <>
                    <button
                      onClick={doApprove}
                      disabled={approve.isPending}
                      className="flex w-full items-center justify-center gap-3 rounded-xl bg-forest py-4 font-bold text-cream shadow-md transition hover:bg-forest-deep active:scale-95 disabled:opacity-60"
                    >
                      <Check size={18} />
                      {t("admin.approveTopicBtn")}
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-red-400 py-4 font-bold text-red-500 transition hover:bg-red-50 active:scale-95"
                    >
                      <X size={18} />
                      {t("admin.rejectTopicBtn")}
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-forest">
                      {t("admin.rejectionReason")}
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={4}
                      className="w-full resize-y rounded-xl border border-forest/15 bg-cream-2 p-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
                      placeholder={t("admin.rejectionReasonPlaceholder")}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={doReject}
                        disabled={reject.isPending}
                        className="flex-1 rounded-xl bg-red-500 py-3 font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
                      >
                        {t("admin.confirmReject")}
                      </button>
                      <button
                        onClick={() => {
                          setRejecting(false);
                          setReason("");
                        }}
                        className="flex-1 rounded-xl border border-forest/20 py-3 font-bold text-forest transition hover:bg-forest/5"
                      >
                        {t("admin.cancel")}
                      </button>
                    </div>
                  </div>
                )}
                <p className="mt-4 text-center text-[11px] text-clay opacity-70">
                  {t("admin.decisionNote")}
                </p>
              </div>
            ) : (
              <div
                className={`rounded-xl p-4 text-center text-sm font-semibold ${STATUS_STYLES[topic.status] ?? "bg-gray-100 text-gray-600"}`}
              >
                {topic.status === "rejected" && topic.rejectionReason
                  ? `${t("status.rejected")}: ${topic.rejectionReason}`
                  : t(`status.${topic.status}`, { defaultValue: topic.status })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-forest/5"}`}
    >
      <span className="text-sm text-clay">{label}</span>
      <span className="font-bold text-forest">{value}</span>
    </div>
  );
}
