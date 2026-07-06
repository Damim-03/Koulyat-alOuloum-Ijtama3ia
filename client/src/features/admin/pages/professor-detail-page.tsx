import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Mail,
  Phone,
  IdCard,
  Building2,
  GraduationCap,
  BadgeCheck,
  ShieldAlert,
  Clock,
  CalendarDays,
  FileText,
  Award,
  Tag,
  AtSign,
  Pencil,
  Trash2,
  Hash,
  Users,
  ChevronLeft,
  Briefcase,
  CheckCircle2,
  Sparkles,
  PieChart,
} from "lucide-react";
import { useProfessor, useDeleteProfessor } from "../hooks/admin-hook";
import type { Professor, ProfessorTopicLite } from "../../../types/admin";
import { ProfessorEditDialog } from "../components/professor-edit-dialog";
import { ConfirmDialog } from "../components/confirm-dialog";

const TOPIC_STATUS: Record<
  string,
  { label: string; cls: string; edge: string }
> = {
  pending: {
    label: "قيد المراجعة",
    cls: "bg-amber-100 text-amber-600",
    edge: "border-r-amber-400",
  },
  approved: {
    label: "معتمد",
    cls: "bg-emerald-100 text-emerald-600",
    edge: "border-r-emerald-500",
  },
  open: {
    label: "مفتوح",
    cls: "bg-soft-sage/50 text-forest",
    edge: "border-r-sage",
  },
  full: { label: "مكتمل", cls: "bg-gold/15 text-gold", edge: "border-r-gold" },
  rejected: {
    label: "مرفوض",
    cls: "bg-red-100 text-red-500",
    edge: "border-r-red-400",
  },
  archived: {
    label: "مؤرشف",
    cls: "bg-clay/15 text-clay",
    edge: "border-r-clay",
  },
};

// Ordered palette for the status-distribution bar + legend.
const STATUS_BAR: { key: string; label: string; bar: string; dot: string }[] = [
  {
    key: "approved",
    label: "معتمد",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  { key: "open", label: "مفتوح", bar: "bg-sage", dot: "bg-sage" },
  { key: "full", label: "مكتمل", bar: "bg-gold", dot: "bg-gold" },
  {
    key: "pending",
    label: "قيد المراجعة",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
  },
  { key: "rejected", label: "مرفوض", bar: "bg-red-400", dot: "bg-red-400" },
  { key: "archived", label: "مؤرشف", bar: "bg-clay", dot: "bg-clay" },
];

function initials(
  first?: string | null,
  last?: string | null,
  fallback = "\u061f",
) {
  return (first?.[0] ?? "") + (last?.[0] ?? "") || fallback;
}
function fullName(p: Professor) {
  return (
    [p.user?.firstName, p.user?.lastName].filter(Boolean).join(" ") ||
    p.universityEmail ||
    "\u2014"
  );
}
function fmtDate(iso?: string | null) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "\u2014"
    : d.toLocaleDateString("ar", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

export function AdminProfessorDetailPage() {
  useTranslation();
  const navigate = useNavigate();
  const { lang, id } = useParams();

  const { data: professor, isLoading } = useProfessor(id ?? null);
  const deleteProfessor = useDeleteProfessor();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const backToList = () => navigate(`/${lang}/admin/professors`);
  const goToTopic = (topicId: string) =>
    navigate(`/${lang}/admin/topics/${topicId}`);

  function confirmDelete() {
    if (!professor) return;
    deleteProfessor.mutate(professor.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        backToList();
      },
    });
  }

  if (isLoading) {
    return (
      <div className="font-body grid place-items-center py-24 text-sm text-clay">
        {"\u2026"}
      </div>
    );
  }

  if (!professor) {
    return (
      <div className="font-body py-24 text-center">
        <p className="text-sm text-clay">لم يتم العثور على الأستاذ</p>
        <button
          onClick={backToList}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
        >
          <ArrowRight size={16} /> العودة إلى الأساتذة
        </button>
      </div>
    );
  }

  const p = professor;
  const facultyName = p.department?.faculty?.name ?? null;
  const tags = p.tags ?? [];
  const grades = p.grade ?? [];
  const topics = p.topics ?? [];
  const isActive = p.user?.status === "active";

  // ── computed analytics from the professor's own topics ──
  const totalTopics = p._count?.topics ?? topics.length;
  const statusCounts: Record<string, number> = {};
  for (const t of topics)
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
  const approved = statusCounts["approved"] ?? 0;
  const pending = statusCounts["pending"] ?? 0;
  const totalApplications = topics.reduce(
    (s, t) => s + (t._count?.applications ?? 0),
    0,
  );
  const barSegs = STATUS_BAR.filter((s) => (statusCounts[s.key] ?? 0) > 0);
  const barTotal = topics.length || 1;

  const info: {
    icon: typeof Mail;
    label: string;
    value: string;
    dir?: "ltr";
  }[] = [
    {
      icon: Hash,
      label: "الرقم الوظيفي",
      value: p.employeeNumber || "\u2014",
      dir: "ltr",
    },
    {
      icon: Mail,
      label: "البريد الجامعي",
      value: p.universityEmail || "\u2014",
      dir: "ltr",
    },
    {
      icon: AtSign,
      label: "البريد الشخصي",
      value: p.user?.email || "\u2014",
      dir: "ltr",
    },
    {
      icon: Phone,
      label: "رقم الهاتف",
      value: p.user?.phone || "\u2014",
      dir: "ltr",
    },
    {
      icon: IdCard,
      label: "اسم المستخدم",
      value: p.user?.username || "\u2014",
      dir: "ltr",
    },
    { icon: Building2, label: "القسم", value: p.department?.name ?? "\u2014" },
    { icon: GraduationCap, label: "الكلّية", value: facultyName ?? "\u2014" },
    { icon: Clock, label: "آخر دخول", value: fmtDate(p.user?.lastLoginAt) },
    {
      icon: CalendarDays,
      label: "تاريخ الانضمام",
      value: fmtDate(p.user?.createdAt),
    },
  ];

  return (
    <div className="font-body mx-auto max-w-5xl">
      {/* back */}
      <button
        onClick={backToList}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-clay transition hover:text-forest"
      >
        <ArrowRight size={16} /> العودة إلى الأساتذة
      </button>

      {/* ── Professor hero card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-[0_10px_40px_rgba(38,66,61,0.10)]">
        {/* layered gradient banner */}
        <div className="relative h-36 bg-linear-to-l from-forest via-forest-deep to-forest">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,var(--color-cream)_1px,transparent_0)] bg-size-[18px_18px]" />
          <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-gold/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-6 left-24 size-40 rounded-full bg-sage/20 blur-3xl" />
          <GraduationCap
            className="pointer-events-none absolute -bottom-3 left-6 size-28 text-cream/10"
            strokeWidth={1.5}
          />
          <Sparkles size={16} className="absolute right-6 top-6 text-gold/60" />
        </div>

        <div className="px-6 pb-6 sm:px-8">
          {/* avatar overlapping banner */}
          <div className="-mt-16 flex">
            <div className="relative">
              {p.user?.avatarUrl ? (
                <img
                  src={p.user.avatarUrl}
                  alt=""
                  className="size-28 rounded-3xl border-4 border-cream-card object-cover shadow-lg"
                />
              ) : (
                <div className="grid size-28 place-items-center rounded-3xl border-4 border-cream-card bg-linear-to-br from-gold to-gold-soft text-3xl font-bold text-forest-deep shadow-lg">
                  {initials(p.user?.firstName, p.user?.lastName)}
                </div>
              )}
              <span
                className={`absolute bottom-1 left-1 size-6 rounded-full border-4 border-cream-card ${
                  isActive ? "bg-emerald-500" : "bg-red-500"
                }`}
                title={isActive ? "نشط" : "موقوف"}
              />
            </div>
          </div>

          {/* name + action buttons */}
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold text-forest sm:text-3xl">
                {fullName(p)}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {grades.map((g) => (
                  <span
                    key={`g-${g}`}
                    className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold"
                  >
                    <Award size={12} /> {g}
                  </span>
                ))}
                {isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    <BadgeCheck size={12} /> نشط
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-500">
                    <ShieldAlert size={12} /> موقوف
                  </span>
                )}
                {p.user?.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-soft-sage/50 px-2.5 py-0.5 text-xs font-semibold text-forest">
                    <BadgeCheck size={12} /> موثّق
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
              >
                <Pencil size={15} /> تعديل
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-50"
              >
                <Trash2 size={15} /> حذف
              </button>
            </div>
          </div>

          {/* quick meta */}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-clay">
            <span className="inline-flex items-center gap-1.5" dir="ltr">
              <Mail size={14} /> {p.universityEmail || "\u2014"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={14} /> {p.department?.name ?? "\u2014"}
            </span>
            {facultyName && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap size={14} /> {facultyName}
              </span>
            )}
          </div>

          {/* صفة (tags) */}
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-clay">
                <Tag size={13} /> الصفة:
              </span>
              {tags.map((tg) => (
                <span
                  key={`t-${tg}`}
                  className="inline-flex rounded-full bg-soft-sage/50 px-2.5 py-0.5 text-xs font-medium text-forest"
                >
                  {tg}
                </span>
              ))}
            </div>
          )}

          {/* stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat
              icon={Briefcase}
              value={totalTopics}
              label="إجمالي المواضيع"
              tint="bg-forest/8 text-forest"
            />
            <MiniStat
              icon={CheckCircle2}
              value={approved}
              label="مواضيع معتمدة"
              tint="bg-emerald-100 text-emerald-600"
            />
            <MiniStat
              icon={Clock}
              value={pending}
              label="قيد المراجعة"
              tint="bg-amber-100 text-amber-600"
            />
            <MiniStat
              icon={Users}
              value={totalApplications}
              label="إجمالي الطلبات"
              tint="bg-gold/15 text-gold"
            />
          </div>
        </div>
      </div>

      {/* ── Topic status distribution ── */}
      {topics.length > 0 && (
        <div className="mt-6 rounded-3xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:p-8">
          <h2 className="mb-5 flex items-center gap-2 font-serif text-lg font-bold text-forest">
            <span className="grid size-8 place-items-center rounded-lg bg-forest/5">
              <PieChart size={17} />
            </span>
            توزيع المواضيع حسب الحالة
          </h2>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-cream-2">
            {barSegs.map((s) => (
              <div
                key={s.key}
                className={`${s.bar} h-full transition-all`}
                style={{
                  width: `${((statusCounts[s.key] ?? 0) / barTotal) * 100}%`,
                }}
                title={`${s.label}: ${statusCounts[s.key]}`}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {barSegs.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 text-xs text-clay"
              >
                <span className={`size-2.5 rounded-full ${s.dot}`} />
                {s.label}
                <span className="font-bold text-forest">
                  {statusCounts[s.key]}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Personal information ── */}
      <div className="mt-6 rounded-3xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:p-8">
        <h2 className="mb-5 flex items-center gap-2 font-serif text-lg font-bold text-forest">
          <span className="grid size-8 place-items-center rounded-lg bg-forest/5">
            <IdCard size={17} />
          </span>
          المعلومات الشخصية
        </h2>
        <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
          {info.map((row) => (
            <InfoRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              value={row.value}
              dir={row.dir}
            />
          ))}
        </div>
      </div>

      {/* ── Topics (clickable) ── */}
      <div className="mt-6 rounded-3xl border border-forest/10 bg-cream-card p-6 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:p-8">
        <h2 className="mb-5 flex items-center gap-2 font-serif text-lg font-bold text-forest">
          <span className="grid size-8 place-items-center rounded-lg bg-forest/5">
            <Briefcase size={17} />
          </span>
          المواضيع المُرسَلة
          <span className="rounded-full bg-forest/8 px-2 py-0.5 text-xs font-bold text-forest">
            {topics.length}
          </span>
        </h2>

        {topics.length === 0 ? (
          <div className="grid place-items-center gap-2 py-10 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-forest/5 text-clay">
              <FileText size={22} />
            </div>
            <p className="text-sm text-clay">لا توجد مواضيع مُرسَلة بعد.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {topics.map((tp) => (
              <TopicRow
                key={tp.id}
                topic={tp}
                onClick={() => goToTopic(tp.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* dialogs */}
      <ProfessorEditDialog
        open={editOpen}
        professor={p}
        onClose={() => setEditOpen(false)}
      />
      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title="حذف الأستاذ"
        message={`هل أنت متأكّد من حذف «${fullName(p)}»؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="نعم، احذف"
        cancelLabel="إلغاء"
        loading={deleteProfessor.isPending}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function TopicRow({
  topic,
  onClick,
}: {
  topic: ProfessorTopicLite;
  onClick: () => void;
}) {
  const status = TOPIC_STATUS[topic.status] ?? {
    label: topic.status,
    cls: "bg-clay/15 text-clay",
    edge: "border-r-clay",
  };
  return (
    <li>
      <button
        onClick={onClick}
        className={`group flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-forest/10 border-r-4 ${status.edge} bg-cream-2 px-4 py-3 text-right transition hover:-translate-y-0.5 hover:border-gold/40 hover:bg-gold/5 hover:shadow-[0_6px_20px_rgba(38,66,61,0.08)]`}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-forest group-hover:text-forest-deep">
            {topic.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-clay">
            {topic.specialization?.name && (
              <span className="inline-flex items-center gap-1">
                <GraduationCap size={12} /> {topic.specialization.name}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users size={12} /> {topic._count?.applications ?? 0} طلب
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} /> {fmtDate(topic.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Hash size={12} /> {topic.maxStudents} كحدّ أقصى
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}
          >
            {status.label}
          </span>
          <ChevronLeft
            size={18}
            className="text-clay/40 transition group-hover:-translate-x-0.5 group-hover:text-gold"
          />
        </div>
      </button>
    </li>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Mail;
  value: number | string;
  label: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-2 p-3.5 transition hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-[0_6px_20px_rgba(38,66,61,0.08)]">
      <div
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="truncate font-serif text-base font-bold text-forest">
          {value}
        </p>
        <p className="text-[11px] text-clay">{label}</p>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  dir?: "ltr";
}) {
  return (
    <div className="flex items-start gap-3 border-b border-forest/5 pb-3">
      <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-forest/5 text-forest">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-clay">{label}</p>
        <p className="truncate text-sm font-semibold text-forest" dir={dir}>
          {value}
        </p>
      </div>
    </div>
  );
}
