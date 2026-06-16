import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Users,
  CalendarDays,
  GraduationCap,
  Target,
  ListChecks,
  Mail,
  MapPin,
  Loader2,
  FolderSearch,
  FlaskConical,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useTopic } from "../hooks/Student-hook";
// ⚠️ طابِق اسم/مسار/props هذا المكوّن مع ما تستعمله في browse-topics.page.tsx
import { GroupRequestDialog } from "../components/group-request-dialog";
import type { TopicView } from "../../../types/student.types";

const SHADOW = "shadow-[0_4px_20px_rgba(38,66,61,0.06)]";

const STATUS_PILL: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800",
  published: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-sky-100 text-sky-700",
  full: "bg-violet-100 text-violet-700",
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-700",
};

function initials(name?: string | null) {
  if (!name) return "؟";
  const clean = name.replace(/^(د\.?|أ\.?|prof\.?|dr\.?)\s*/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "") || "؟";
}

/** يحوّل حقل قد يكون نصًّا أو مصفوفة إلى مصفوفة أسطر نظيفة. */
function toLines(val?: string | string[] | null): string[] {
  if (Array.isArray(val))
    return val.map((s) => String(s).trim()).filter(Boolean);
  if (typeof val === "string")
    return val
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

export function StudentTopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { dir } = useLanguage();
  const { t, i18n } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: topic, isLoading, isError } = useTopic(id ?? null);

  const isRtl = dir === "rtl";
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const locale = i18n.language?.startsWith("ar")
    ? "ar"
    : i18n.language?.startsWith("fr")
      ? "fr"
      : "en";

  const v = useMemo<TopicView>(() => (topic ?? {}) as TopicView, [topic]);

  const status = v.status ?? "open";
  const isFull = status === "full";
  // status.* لا يحوي "published" → نعامله كـ open
  const statusKey = status === "published" ? "open" : status;
  const statusLabel = t(`status.${statusKey}`, { defaultValue: status });
  const requirements = v.requirements ?? [];
  const objectives = toLines(v.objectives);
  const descriptionLines = toLines(v.description);
  const year = v.academicYear?.title ?? null;
  const spec = v.specialization?.name ?? null;

  const profName =
    [v.professor?.user?.firstName, v.professor?.user?.lastName]
      .filter(Boolean)
      .join(" ") || "—";
  const profEmail = v.professor?.user?.email ?? null;
  const profOffice = v.professor?.office ?? null;

  const publishedAt = useMemo(() => {
    if (!v.createdAt) return null;
    const d = new Date(v.createdAt);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);
  }, [v.createdAt, locale]);

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-7 animate-spin text-sage" />
      </div>
    );
  }

  /* ── not found / error ── */
  if (isError || !topic) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl bg-cream-card p-10 text-center ring-1 ring-clay/10">
        <div className="grid size-14 place-items-center rounded-full bg-forest/5 text-sage">
          <FolderSearch className="size-7" />
        </div>
        <h2 className="font-serif text-lg text-forest">
          {t("stu.topicNotFound")}
        </h2>
        <p className="text-sm text-clay">{t("stu.topicNotFoundDesc")}</p>
        <Link
          to=".."
          relative="path"
          className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-medium text-cream-2 transition hover:bg-forest-deep"
        >
          <BackArrow className="size-4" />
          {t("stu.backToTopics")}
        </Link>
      </div>
    );
  }

  return (
    <div dir={dir} className="mx-auto max-w-7xl font-body">
      {/* ── back link ── */}
      <Link
        to=".."
        relative="path"
        className="mb-8 inline-flex items-center gap-2 text-base font-medium text-forest transition hover:text-sage"
      >
        <BackArrow className="size-5" />
        {t("stu.backToTopics")}
      </Link>

      {/* ── hero ── */}
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <span
            className={`mb-4 inline-flex items-center rounded-full px-4 py-1 text-sm font-semibold ${
              STATUS_PILL[status] ?? STATUS_PILL.open
            }`}
          >
            {statusLabel}
          </span>
          <h1 className="font-serif text-3xl font-bold leading-tight text-forest md:text-5xl">
            {v.title ?? "—"}
          </h1>
        </div>

        <button
          type="button"
          disabled={isFull}
          onClick={() => setDialogOpen(true)}
          className="inline-flex shrink-0 items-center gap-3 rounded-xl bg-gold px-8 py-4 font-bold text-forest-deep shadow-lg transition hover:bg-gold-soft active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="size-5" />
          {t("stu.submitGroupRequest")}
        </button>
      </div>

      {/* ── meta tiles strip ── */}
      <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        <InfoTile
          icon={ListChecks}
          label={t("stu.filterSpec")}
          value={spec ?? "—"}
        />
        <InfoTile
          icon={CalendarDays}
          label={t("stu.academicYear")}
          value={year ?? "—"}
        />
        <InfoTile
          icon={Users}
          label={t("stu.maxStudents")}
          value={
            v.maxStudents != null
              ? t("stu.studentsCount", {
                  number: String(v.maxStudents).padStart(2, "0"),
                })
              : "—"
          }
        />
        <InfoTile
          icon={GraduationCap}
          label={t("stu.supervisor")}
          value={profName}
        />
      </div>

      {/* ── main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* main column */}
        <div className="space-y-6 lg:col-span-8">
          {/* project details */}
          <section
            className={`rounded-2xl bg-cream-card p-6 ring-1 ring-clay/10 ${SHADOW}`}
          >
            <h2 className="mb-5 font-serif text-2xl font-semibold text-forest">
              {t("stu.projectDetails")}
            </h2>
            {descriptionLines.length ? (
              <div className="space-y-3 text-base leading-relaxed text-clay text-justify">
                {descriptionLines.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-clay">{t("stu.noDescription")}</p>
            )}
          </section>

          {/* requirements + objectives */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <BulletCard
              title={t("stu.requirements")}
              icon={ListChecks}
              accent="gold"
              items={requirements}
              empty={t("stu.noRequirements")}
            />
            <BulletCard
              title={t("stu.objectives")}
              icon={Target}
              accent="sage"
              items={objectives}
              empty={t("stu.noObjectives")}
            />
          </div>
        </div>

        {/* sidebar */}
        <div className="space-y-6 lg:col-span-4">
          {/* supervisor */}
          <div
            className={`group relative overflow-hidden rounded-2xl bg-forest p-6 text-cream-2 ${SHADOW}`}
          >
            <div className="absolute -top-4 size-24 rounded-full bg-cream/10 blur-2xl transition-all group-hover:bg-cream/20 ltr:-right-4 rtl:-left-4" />
            <div className="relative z-10">
              <h3 className="mb-4 text-xs font-medium text-soft-sage">
                {t("stu.supervisor")}
              </h3>
              <div className="flex items-center gap-4">
                <div className="grid size-16 shrink-0 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep font-serif text-xl font-bold text-gold-soft ring-2 ring-gold/30">
                  {initials(profName)}
                </div>
                <h4 className="min-w-0 font-serif text-lg text-cream">
                  {profName}
                </h4>
              </div>
              <div className="mt-6 space-y-3 border-t border-cream/10 pt-6 text-sm">
                {profEmail && (
                  <p className="flex items-center gap-3 text-soft-sage">
                    <Mail className="size-4 shrink-0 text-gold-soft" />
                    <span dir="ltr" className="truncate">
                      {profEmail}
                    </span>
                  </p>
                )}
                {profOffice && (
                  <p className="flex items-center gap-3 text-soft-sage">
                    <MapPin className="size-4 shrink-0 text-gold-soft" />
                    <span>{t("stu.office", { number: profOffice })}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* extra info */}
          <div
            className={`rounded-2xl bg-cream-2 p-6 ring-1 ring-clay/10 ${SHADOW}`}
          >
            <h3 className="mb-4 font-serif text-lg font-semibold text-forest">
              {t("stu.extraInfo")}
            </h3>
            <div className="text-sm">
              <InfoRow
                label={t("stu.publishedAt")}
                value={publishedAt ?? "—"}
              />
              <InfoRow label={t("stu.projectType")} value={v.type ?? "—"} />
              <InfoRow label={t("stu.topicStatus")} value={statusLabel} />
              <InfoRow label={t("stu.topicCode")} value={v.code ?? "—"} last />
            </div>
          </div>

          {/* cover image */}
          {v.coverImage && (
            <div className="relative h-64 overflow-hidden rounded-2xl shadow-md">
              <img
                src={v.coverImage}
                alt={v.title ?? ""}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-forest/85 to-transparent" />
              <div className="absolute inset-x-4 bottom-4 text-cream">
                <p className="flex items-center gap-1.5 text-xs opacity-80">
                  <FlaskConical className="size-3.5" />
                  {t("stu.researchField")}
                </p>
                {spec && <h4 className="font-serif text-lg">{spec}</h4>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ⚠️ طابِق هذه الـ props مع توقيع GroupRequestDialog عندك */}
      {dialogOpen && (
        <GroupRequestDialog
          topic={topic}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}

/* ── helpers ── */
function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-cream-2 p-5 ring-1 ring-clay/10">
      <span className="flex items-center gap-1.5 text-xs font-medium text-clay">
        <Icon className="size-3.5 text-sage" />
        {label}
      </span>
      <span className="truncate font-semibold text-forest">{value}</span>
    </div>
  );
}

function BulletCard({
  title,
  icon: Icon,
  accent,
  items,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "gold" | "sage";
  items: string[];
  empty: string;
}) {
  const top = accent === "gold" ? "border-t-gold" : "border-t-sage";
  const ic = accent === "gold" ? "text-gold" : "text-sage";
  const dot = accent === "gold" ? "bg-gold" : "bg-sage";
  return (
    <div
      className={`rounded-2xl border-t-4 bg-cream-card p-6 ring-1 ring-clay/10 ${top} ${SHADOW}`}
    >
      <h3 className="mb-5 flex items-center gap-2 font-serif text-lg font-semibold text-forest">
        <Icon className={`size-5 ${ic}`} />
        {title}
      </h3>
      {items.length ? (
        <ul className="space-y-3 text-sm leading-relaxed text-clay">
          {items.map((it, i) => (
            <li key={`${it}-${i}`} className="flex items-start gap-3">
              <span className={`mt-2 size-1.5 shrink-0 rounded-full ${dot}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-clay">{empty}</p>
      )}
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
      className={`flex items-center justify-between gap-3 py-2.5 ${
        last ? "" : "border-b border-clay/10"
      }`}
    >
      <span className="text-clay">{label}</span>
      <span className="font-semibold text-forest">{value}</span>
    </div>
  );
}
