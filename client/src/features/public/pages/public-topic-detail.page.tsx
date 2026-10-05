import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  Users,
  CalendarDays,
  Target,
  ListChecks,
  UserPlus,
  Share2,
  Info,
  Layers,
  Lock,
  Sparkles,
  Subtitles,
  CheckCircle2,
  Award,
  Building2,
  Landmark,
  GraduationCap,
  CalendarClock,
  Search,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { usePublicTopic } from "../hooks/public-hook";
import { noneText } from "../../../lib/none-text";
import { useAuth } from "../../../hooks/use-auth";
// ⚠️ طابِق المسار مع موقع GroupRequestDialog عندك (موجود ضمن ميزة الطالب).
import { GroupRequestDialog } from "../../student/components/group-request-dialog";
import { LoadingArea } from "../../../components/ui/loading-area";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { ReservedTopicPanel } from "../components/reserved-topic";
import { personName } from "../../../lib/person-name";

const CARD =
  "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_24px_rgba(38,66,61,0.06)]";

const LEVEL_KEY: Record<string, string> = {
  licence: "stu.levelLicence",
  master: "stu.levelMaster",
  doctorate: "stu.levelDoctorate",
};

/**
 * A published topic, as anyone signed in reads it.
 *
 * The header carries everything a reader decides on — the title, who
 * supervises it, the year, how many seats, whether it is still free — and,
 * beside it, the one thing to do about it. The request used to sit in a
 * sidebar beside the content, so the page read as two columns of half-empty
 * cards; it is now in the header, where the decision is made.
 */
export function PublicTopicDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { id = "", lang } = useParams();

  const { isAuthenticated, role } = useAuth();

  const { data: topic, isLoading, isError, error, refetch } =
    usePublicTopic(id);

  // محجوزٌ لفريقٍ آخر ووُصل إليه بالرابط: الخادم لا يُسلّم تفاصيله، والصفحة
  // تقول لماذا بدل «تعذّر التحميل».
  const reservedForOthers =
    (error as { response?: { data?: { errorCode?: string } } } | null)
      ?.response?.data?.errorCode === "TOPIC_RESERVED";
  const [dialogOpen, setDialogOpen] = useState(false);

  // القائمة تحمل فلاترها في الرابط وتُسلّمها هنا: «العودة» تعيد إليها كما
  // تُركت، لا إلى صفحتها الأولى بلا فلتر.
  const listSearch =
    (location.state as { listSearch?: string } | null)?.listSearch ?? "";

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
    });
  }

  /**
   * «مشاركة» كان زرّاً لا `onClick` له: يُضغط فلا يقع شيء، وهو أسوأ من
   * غيابه — الزرّ يَعِد بفعلٍ ثم يصمت.
   */
  function fmtDate(iso?: string | null) {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat(i18n.language || "ar", {
        dateStyle: "medium",
      }).format(new Date(iso));
    } catch {
      return null;
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("public.linkCopied"));
    } catch {
      toast.error(t("admin.actionFailed"));
    }
  }

  if (isLoading) {
    return <LoadingArea className="font-body py-20" />;
  }

  if (reservedForOthers) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-5 px-4 py-10 font-body">
        <button
          type="button"
          onClick={() => navigate(`/${lang}/topics${listSearch}`)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest transition hover:text-gold"
        >
          <ChevronRight size={18} className="ltr:rotate-180" />
          {t("public.backToTopics")}
        </button>
        <div className="animate-scale-in">
          <ReservedTopicPanel
            onBrowseAvailable={() => navigate(`/${lang}/topics?status=available`)}
          />
        </div>
      </div>
    );
  }

  // انقطاعُ الاتّصال ليس «غير موجود»: يُقال ما جرى ويُعرض زرُّ إعادة.
  if (isError) {
    return <ErrorRetry onRetry={() => refetch()} />;
  }
  if (!topic) {
    return (
      <div className="mx-auto w-full max-w-6xl px-6 py-8 font-body">
        <div className={`${CARD} px-6 py-20 text-center text-sm text-clay`}>
          {t("public.topicNotFound")}
        </div>
      </div>
    );
  }

  const profName =
    personName(topic.professor?.user) || "—";
  const requirements = topic.requirements ?? [];
  const objectives = topic.objectives ?? [];

  // The rank is JSON: a list of strings, or a lone string on older rows.
  const rawGrade = topic.professor?.grade;
  const grades: string[] = Array.isArray(rawGrade)
    ? rawGrade.filter((g): g is string => typeof g === "string" && !!g.trim())
    : typeof rawGrade === "string" && rawGrade.trim()
      ? [rawGrade.trim()]
      : [];
  const department = topic.professor?.department?.name ?? null;
  const faculty = topic.professor?.department?.faculty?.name ?? null;
  const levelKey = topic.specialization?.level
    ? LEVEL_KEY[topic.specialization.level]
    : null;
  const published = fmtDate(topic.publishedAt ?? topic.createdAt);

  /**
   * التلميح كان واحداً للجميع: «يجب تسجيل الدخول كطالب…» — يقرؤه الطالب
   * الداخل بحسابه فيحسب أنّ شيئاً ناقصاً، ويقرؤه الأستاذ فيظنّ الزرّ له.
   * فصار لكلّ حالٍ سطره: زائرٌ يُدعى للدخول، وغيرُ الطالب يُقال له إنّ
   * التقديم ليس لدوره، والطالبُ يُقال له ما يقع عند الضغط.
   */
  const applyHint = !isAuthenticated
    ? t("public.applyHint")
    : role !== "student"
      ? t("public.applyStudentsOnly")
      : t("public.applyReady");

  const notForRole = isAuthenticated && role !== "student";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8 font-body">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(`/${lang}/topics${listSearch}`)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest transition hover:text-gold"
      >
        <ChevronRight size={18} className="ltr:rotate-180" />
        {t("public.backToTopics")}
      </button>

      {/* ══════════ header: the topic, and the request ══════════ */}
      <section className="relative rounded-3xl bg-linear-to-br from-forest to-forest-deep p-6 text-cream shadow-[0_12px_40px_rgba(26,49,45,0.25)] sm:p-8">
        {/* ornament, clipped by a layer of its own so the card never scrolls */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
        >
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="absolute -end-16 -top-28 size-96 rounded-full bg-gold/25 blur-3xl" />
          <div className="absolute -start-10 -bottom-32 size-80 rounded-full bg-soft-sage/15 blur-3xl" />
          <div className="absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />
        </div>

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-stretch">
          {/* what the topic is */}
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                  topic.isAvailable
                    ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/35"
                    : "bg-violet-400/15 text-violet-300 ring-violet-400/35"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    topic.isAvailable ? "bg-emerald-300" : "bg-violet-300"
                  }`}
                />
                {topic.isAvailable ? t("public.available") : t("public.reserved")}
              </span>
              <HeroChip icon={Layers}>
                {topic.specialization?.name ?? noneText()}
              </HeroChip>
            </div>

            {/* The title with what is asked about it first — who
                supervises, which year, how many seats — in one block. */}
            <div>
              <h1 className="font-serif text-3xl leading-tight font-bold break-words text-cream lg:text-4xl">
                {topic.title}
              </h1>

              {/* the supervisor, introduced as a directory would: photo,
                  rank, department, faculty */}
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gold/25 bg-white/5 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="relative shrink-0 self-start sm:self-center">
                  <div className="rounded-full bg-linear-to-br from-gold-soft via-gold to-gold-soft/30 p-[3px] shadow-[0_8px_24px_rgba(193,150,90,0.3)]">
                    <UserAvatar
                      user={topic.professor?.user}
                      size={76}
                      tone="gold"
                      className="text-[var(--t-brand-deep)]! ring-4 ring-[var(--t-brand-deep)]"
                    />
                  </div>
                  <span className="absolute -end-0.5 -bottom-0.5 grid size-7 place-items-center rounded-full bg-gold text-[var(--t-brand-deep)] ring-4 ring-[var(--t-brand-deep)]">
                    <GraduationCap size={14} />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-wide text-gold-soft">
                    {t("public.supervisor")}
                  </p>
                  <p className="truncate font-serif text-xl font-bold text-cream">
                    {profName}
                  </p>
                  {grades.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {grades.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-bold text-gold-soft ring-1 ring-gold/30"
                        >
                          <Award size={11} />
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                  {(department || faculty) && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft-sage">
                      {department && (
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 size={13} className="shrink-0 text-gold-soft" />
                          {department}
                        </span>
                      )}
                      {faculty && (
                        <span className="inline-flex items-center gap-1.5">
                          <Landmark size={13} className="shrink-0 text-gold-soft" />
                          {faculty}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* the facts, each with its name: a bare "2025/2026" leaves
                  the reader to guess what it is */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <HeroFact
                  icon={CalendarDays}
                  label={t("public.facts.year")}
                  value={topic.academicYear?.title ?? noneText(true)}
                />
                <HeroFact
                  icon={Users}
                  label={t("public.facts.seats")}
                  value={t("public.maxStudentsN", { n: topic.maxStudents })}
                />
                {levelKey && (
                  <HeroFact
                    icon={GraduationCap}
                    label={t("public.facts.level")}
                    value={t(levelKey)}
                  />
                )}
                {published && (
                  <HeroFact
                    icon={CalendarClock}
                    label={t("public.facts.published")}
                    value={published}
                  />
                )}
              </div>
            </div>
          </div>

          {/* What to do about it. The panel is as tall as the header, so
              the space between its status and its buttons carries the three
              steps of a request rather than nothing. */}
          <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-gold/30 bg-white/5 p-5 backdrop-blur-sm lg:w-80">
            {/* where the topic stands */}
            <div className="flex items-center gap-3">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ring-1 ${
                  topic.isAvailable
                    ? "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30"
                    : "bg-violet-400/15 text-violet-300 ring-violet-400/30"
                }`}
              >
                {topic.isAvailable ? <UserPlus size={22} /> : <Lock size={22} />}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gold-soft">
                  <Sparkles size={12} />
                  {t("public.joinTitle")}
                </p>
                <p className="font-serif text-lg leading-snug font-bold text-cream">
                  {topic.isAvailable
                    ? t("public.panel.openNow")
                    : t("public.panel.takenTitle")}
                </p>
              </div>
            </div>

            {/* how a request goes, or why there is none to send */}
            {topic.isAvailable ? (
              <ol className="relative my-5 space-y-3">
                <span
                  aria-hidden="true"
                  className="absolute start-[13px] top-3 bottom-3 w-px bg-gold/25"
                />
                {[
                  t("public.panel.stepTeam", { n: topic.maxStudents }),
                  t("public.panel.stepSend"),
                  t("public.panel.stepDecide"),
                ].map((step, i) => (
                  <li key={i} className="relative flex items-start gap-3">
                    <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-gold/20 font-serif text-xs font-bold text-gold-soft ring-4 ring-[var(--t-brand-deep)]">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-[13px] leading-relaxed text-cream/90">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="my-5 rounded-xl bg-violet-400/10 px-4 py-3 text-[13px] leading-relaxed text-violet-100 ring-1 ring-violet-300/20">
                {t("public.panel.takenBody")}
              </p>
            )}

            {/* the actions */}
            <div className="mt-auto space-y-2.5">
              {topic.isAvailable ? (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={notForRole}
                  title={notForRole ? t("public.applyStudentsOnly") : undefined}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-l from-gold to-gold-soft py-3.5 font-bold text-[var(--t-brand-deep)] shadow-[0_8px_24px_rgba(193,150,90,0.35)] transition hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                >
                  <UserPlus size={18} />
                  {isAuthenticated
                    ? t("public.applyRequest")
                    : t("public.loginToApply")}
                </button>
              ) : (
                <button
                  type="button"
                  // «مواضيع متاحة أخرى» تفتح تبويب المتاح نفسه، لا القائمة كلّها.
                  onClick={() => navigate(`/${lang}/topics?status=available`)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-3.5 font-bold text-[var(--t-brand-deep)] transition hover:bg-gold-soft active:scale-95"
                >
                  <Search size={17} />
                  {t("public.panel.browseOthers")}
                </button>
              )}

              <button
                type="button"
                onClick={copyLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-cream transition hover:border-gold/50 hover:bg-white/10"
              >
                <Share2 size={15} />
                {t("public.share")}
              </button>
            </div>

            {/* what the button does for this reader */}
            <div
              className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                notForRole
                  ? "bg-[#f0a48f]/10 text-[#f6c3b5] ring-1 ring-[#f0a48f]/25"
                  : "bg-black/10 text-soft-sage"
              }`}
            >
              <Info
                size={14}
                className={`mt-0.5 shrink-0 ${notForRole ? "text-[#f0a48f]" : "text-gold-soft"}`}
              />
              <p>{applyHint}</p>
            </div>
          </aside>
        </div>
      </section>

      {/* ══════════ what it is about ══════════ */}
      <Section icon={Subtitles} title={t("public.descriptionLabel")}>
        <p className="text-[15px] leading-loose whitespace-pre-line text-forest/85">
          {topic.description}
        </p>
      </Section>

      {/* ══════════ what it aims at, and what it asks ══════════
          Side by side when both exist, sharing one height; one alone takes
          the whole row rather than half of it. */}
      {(objectives.length > 0 || requirements.length > 0) && (
        <div
          className={`grid grid-cols-1 gap-6 ${
            objectives.length > 0 && requirements.length > 0 ? "lg:grid-cols-2" : ""
          }`}
        >
          {objectives.length > 0 && (
            <Section icon={Target} title={t("public.objectivesLabel")}>
              <ol className="space-y-2">
                {objectives.map((o, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-2xl bg-cream-2/70 px-4 py-3 ring-1 ring-forest/5"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 font-serif text-sm font-bold text-gold tabular-nums">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 text-sm text-forest">{o}</p>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {requirements.length > 0 && (
            <Section icon={ListChecks} title={t("public.requirementsLabel")}>
              <ul className="space-y-2">
                {requirements.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-2xl bg-cream-2/70 px-4 py-3 ring-1 ring-forest/5"
                  >
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-sage" />
                    <span className="text-sm font-medium text-forest">{r}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {/* Group request dialog — only meaningful for a logged-in student.
          GroupRequestDialog expects { open, onClose, topic }. We pass the
          public topic; its shape provides id/title/maxStudents which the
          dialog reads. */}
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

function HeroChip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-cream">
      <Icon size={12} className="text-gold-soft" />
      {children}
    </span>
  );
}

function HeroFact({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/8 text-gold-soft">
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] text-soft-sage">{label}</span>
        <span className="block truncate text-sm font-bold text-cream">
          {value}
        </span>
      </span>
    </div>
  );
}

/** A card that fills its grid cell, so neighbours on a row share one height. */
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col p-6 ${CARD}`}>
      <header className="mb-5 flex items-center gap-2.5 border-b border-forest/10 pb-4">
        <span className="grid size-9 place-items-center rounded-xl bg-gold/15 text-gold">
          <Icon size={18} />
        </span>
        <h2 className="font-serif text-lg font-bold text-forest">{title}</h2>
      </header>
      {children}
    </section>
  );
}
