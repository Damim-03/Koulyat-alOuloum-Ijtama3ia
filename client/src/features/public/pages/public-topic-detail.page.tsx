import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  User,
  Users,
  CalendarDays,
  Target,
  ListChecks,
  UserPlus,
  Share2,
  Info,
} from "lucide-react";
import { usePublicTopic } from "../hooks/public-hook";
import { useAuth } from "../../../hooks/use-auth";
// ⚠️ طابِق المسار مع موقع GroupRequestDialog عندك (موجود ضمن ميزة الطالب).
import { GroupRequestDialog } from "../../student/components/group-request-dialog";

export function PublicTopicDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id = "", lang } = useParams();

  const { isAuthenticated, role } = useAuth();

  const { data: topic, isLoading } = usePublicTopic(id);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleApply() {
    // Logged-in student → open the group-request dialog right here.
    if (isAuthenticated && role === "student") {
      setDialogOpen(true);
      return;
    }
    // Logged-in but NOT a student (e.g. professor/admin) → cannot apply.
    if (isAuthenticated) return;
    // Visitor → send to login, remembering where to return so we can come
    // straight back to this topic and finish submitting the request.
    navigate(`/${lang}/login`, {
      state: { from: location.pathname },
      // some login pages read a query param instead of state — send both:
    });
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
        {t("public.topicNotFound")}
      </div>
    );
  }

  const profName =
    [topic.professor?.user?.firstName, topic.professor?.user?.lastName]
      .filter(Boolean)
      .join(" ") || "\u2014";
  const requirements = topic.requirements ?? [];
  const objectives = topic.objectives ?? [];

  return (
    <div className="font-body mx-auto w-full max-w-6xl px-6 py-8">
      {/* Back */}
      <button
        onClick={() => navigate(`/${lang}/topics`)}
        className="mb-6 inline-flex items-center gap-2 font-serif text-sm font-bold text-forest transition hover:opacity-80"
      >
        <ChevronRight size={18} className="ltr:rotate-180" />
        {t("public.backToTopics")}
      </button>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        {/* Sidebar: professor + apply */}
        <aside className="space-y-4 lg:order-2">
          <div className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid size-14 place-items-center rounded-xl bg-linear-to-br from-forest to-forest-deep text-cream">
                <User size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-forest">{profName}</h4>
                <p className="text-[11px] text-clay">
                  {t("public.supervisor")}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-forest/10 pt-4 text-xs text-clay">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} />
                {topic.academicYear?.title ?? "\u2014"}
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} />
                {t("public.maxStudentsN", { n: topic.maxStudents })}
              </div>
            </div>

            {/* Apply / login-redirect */}
            <div className="mt-5 space-y-2">
              {topic.isAvailable ? (
                <button
                  onClick={handleApply}
                  disabled={isAuthenticated && role !== "student"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3 font-bold text-forest-deep transition hover:bg-gold-soft disabled:opacity-50"
                >
                  <UserPlus size={18} />
                  {isAuthenticated
                    ? t("public.applyRequest")
                    : t("public.loginToApply")}
                </button>
              ) : (
                <div className="rounded-xl bg-violet-50 py-3 text-center text-sm font-semibold text-violet-600">
                  {t("public.reserved")}
                </div>
              )}
              <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-forest/20 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5">
                <Share2 size={16} />
                {t("public.share")}
              </button>
            </div>
          </div>

          {/* Hint */}
          <div className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/5 p-4 text-[11px] text-clay">
            <Info size={14} className="mt-0.5 shrink-0 text-gold" />
            {t("public.applyHint")}
          </div>
        </aside>

        {/* Main content */}
        <div className="space-y-6 lg:order-1 lg:col-span-2">
          {/* Hero */}
          <div className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-soft-sage/30 px-3 py-1 text-[11px] font-medium text-forest">
                {topic.specialization?.name ?? "\u2014"}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                  topic.isAvailable
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-violet-100 text-violet-700"
                }`}
              >
                {topic.isAvailable
                  ? t("public.available")
                  : t("public.reserved")}
              </span>
            </div>
            <h1 className="font-serif text-2xl font-bold leading-tight text-forest lg:text-3xl">
              {topic.title}
            </h1>
          </div>

          {/* Description */}
          <Section
            icon={<ListChecks size={18} className="text-gold" />}
            title={t("public.descriptionLabel")}
          >
            <p className="whitespace-pre-line leading-relaxed text-clay">
              {topic.description}
            </p>
          </Section>

          {/* Objectives */}
          {objectives.length > 0 && (
            <Section
              icon={<Target size={18} className="text-gold" />}
              title={t("public.objectivesLabel")}
            >
              <ul className="space-y-3">
                {objectives.map((o, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-forest/10 text-xs font-bold text-forest">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 text-sm text-clay">{o}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Requirements */}
          {requirements.length > 0 && (
            <Section
              icon={<ListChecks size={18} className="text-gold" />}
              title={t("public.requirementsLabel")}
            >
              <div className="flex flex-wrap gap-2">
                {requirements.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-cream-2 px-3 py-1.5 text-sm font-medium text-forest"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Group request dialog — only meaningful for a logged-in student.
          GroupRequestDialog expects { open, onClose, topic }. We pass the
          public topic; its shape provides id/title/maxStudents which the
          dialog reads. If your BrowseTopic type is stricter, map fields here. */}
      {dialogOpen && (
        <GroupRequestDialog
          open={dialogOpen}
          topic={topic as never}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)]">
      <div className="mb-4 flex items-center gap-2 border-b border-forest/10 pb-3">
        {icon}
        <h2 className="font-serif text-lg font-bold text-forest">{title}</h2>
      </div>
      {children}
    </section>
  );
}
