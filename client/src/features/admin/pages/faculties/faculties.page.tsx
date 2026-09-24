import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Search,
  ArrowDownUp,
  ChevronLeft,
  Sparkles,
  GraduationCap,
  Layers3,
  TriangleAlert,
} from "lucide-react";
import {
  useFaculties,
  useDeleteFaculty,
  useDepartments,
  useFilieres,
  useSpecializations,
} from "../../hooks/admin-hook";
import type { Faculty } from "../../../../types/admin";
import { useLangNavigate } from "../../../../hooks/useLangNavigate";
import { FacultyFormDialog } from "../../components/dialog/faculty/faculty-dialog.form";
import { AcademicStructureWizard } from "../../components/dialog/academic/academic-structure-wizard";
import { AcademicYearsPanel } from "../../components/academic/academic-years-panel";
import { CoverBanner } from "../../components/ui/cover-banner";
import i18n from "../../../../i18n/i18n";
import { Select } from "../../../../components/ui/select";
import {
  buildFacultyIndex,
  hasGap,
  type FacultyGaps,
} from "../../lib/faculty-index";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";

type SortKey = "name" | "departments";

/** يعرض العدد برقمين (مثل 08) لمطابقة تصميم البطاقات. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** يقرأ عدّاد علاقة من _count بأمان (يُرجع 0 إن لم يوفّره الخادم بعد). */
function countOf(f: Faculty, key: string): number {
  const c = (f as unknown as { _count?: Record<string, number> })._count;
  return c?.[key] ?? 0;
}

export function AdminFacultiesPage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  const {
    data: faculties,
    isLoading,
    isError,
    refetch,
  } = useFaculties();
  const deleteFaculty = useDeleteFaculty();

  // السلسلة كاملةً: المعالج يجلبها كلّها بهذه النداءات نفسها، فهي مخزَّنة.
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<Faculty | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = faculties ?? [];

  // الفهرس في `lib/faculty-index`: قاعدةٌ تُختبر بلا متصفّح، وهنا الرسم.
  const index = useMemo(
    () =>
      buildFacultyIndex(list, departments ?? [], filieres ?? [], specs ?? []),
    [list, departments, filieres, specs],
  );

  // بحث + ترتيب على جهة العميل (قائمة الكليات تأتي كاملة من الخادم).
  const visible = useMemo(() => {
    let arr = list;
    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((f) => index.get(f.id)?.haystack.includes(q));
    }
    return [...arr].sort((a, b) =>
      sort === "departments"
        ? countOf(b, "departments") - countOf(a, "departments")
        : a.name.localeCompare(b.name, i18n.language),
    );
  }, [list, search, sort, index]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(f: Faculty) {
    setEditing(f);
    setDialogOpen(true);
  }
  function handleDelete(f: Faculty) {
    if (confirm(t("admin.confirmDeleteFaculty", { name: f.name })))
      deleteFaculty.mutate(f.id);
  }
  function openDetails(f: Faculty) {
    navigate(`/admin/faculties/${f.id}`);
  }

  return (
    <div className="font-body">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold text-forest">
            {t("admin.facultiesTitle")}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-clay">{t("admin.facultiesSubtitle")}</p>
            <span className="inline-flex items-center rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-medium text-forest">
              {t("admin.facultiesCountBadge", { count: list.length })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-cream-card px-5 py-3 text-sm font-bold text-forest shadow-sm transition hover:border-gold hover:bg-gold/10 active:scale-[0.98]"
          >
            <Layers3 size={18} className="text-gold" />{t("admin.addAcademicStructure")}</button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft active:scale-[0.98]"
          >
            <Plus size={18} />
            {t("admin.addFaculty")}
          </button>
        </div>
      </div>

      {/* Search + sort */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-forest/10 bg-cream-card p-3 shadow-[0_4px_20px_rgba(38,66,61,0.05)] sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute right-3 top-1/2 -translate-y-1/2 text-clay"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.searchFaculty")}
            className="w-full rounded-xl border border-forest/15 bg-cream-2 py-2.5 pr-10 pl-3 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        </div>
        {/* الأيقونة في صفّ المحتوى لا فوقه: انظر تعليق `icon` في `Select`. */}
        <div className="sm:w-56">
          <Select
            value={sort}
            icon={ArrowDownUp}
            aria-label={t("admin.sortNameAsc")}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { value: "name", label: t("admin.sortNameAsc") },
              { value: "departments", label: t("admin.sortDepartmentsDesc") },
            ]}
          />
        </div>
      </div>

      {/* Grid / states */}
      {isLoading ? (
        <LoadingArea className="py-20" />
      ) : isError ? (
        <ErrorRetry onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-cream-card py-16 text-center text-sm text-clay">
          {t("admin.noFaculties")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((f) => (
            <FacultyCard
              key={f.id}
              faculty={f}
              gaps={index.get(f.id)?.gaps}
              onDetails={() => openDetails(f)}
              onEdit={() => openEdit(f)}
              onDelete={() => handleDelete(f)}
            />
          ))}
        </div>
      )}

      {/* Academic years — same level as the faculties, so they live here. */}
      <AcademicYearsPanel />

      {/* Excellence banner */}
      <div className="mt-6 overflow-hidden rounded-2xl bg-linear-to-l from-forest-deep to-forest p-6 text-cream">
        <div className="flex items-center gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-cream/10 text-gold">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold">
              {t("admin.excellenceTitle")}
            </h3>
            <p className="text-sm text-cream/70">{t("admin.excellenceBody")}</p>
          </div>
        </div>
      </div>

      {/* Mounted only while open so each run starts from a clean draft. */}
      {wizardOpen && (
        <AcademicStructureWizard
          open
          onClose={() => setWizardOpen(false)}
        />
      )}

      <FacultyFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        faculty={editing}
      />
    </div>
  );
}

/* ── بطاقة كلية ─────────────────────────────────────────────── */
function FacultyCard({
  faculty: f,
  gaps,
  onDetails,
  onEdit,
  onDelete,
}: {
  faculty: Faculty;
  gaps?: FacultyGaps;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  const stats = [
    { label: t("admin.statDepartments"), value: countOf(f, "departments") },
    { label: t("admin.statDomains"), value: countOf(f, "domains") },
    { label: t("admin.statFilieres"), value: countOf(f, "filieres") },
    {
      label: t("admin.statSpecializations"),
      value: countOf(f, "specializations"),
    },
  ];

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)] transition hover:border-gold/40">
      <div className="p-5">
        <CoverBanner src={f.coverUrl} />
        {/* Icon + actions */}
        <div className="mb-5 flex items-start justify-between">
          {/* شعار الكلّية إن رُفع، وإلّا أيقونة المبنى. و`contain` لا
              `cover`: الشعار يُقصّ أطرافه بالثاني. */}
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-soft-sage/30 text-forest transition group-hover:bg-forest/5">
            {f.iconUrl ? (
              // بلا حشوة: الشعار يملأ المربّع كلّه. والحشوة كانت تتركه
              // صغيراً في وسط فراغٍ لا معنى له، و`contain` يكفي وحده
              // ليبقى كاملاً غير مقصوص.
              <img src={f.iconUrl} alt="" className="size-full object-contain" />
            ) : (
              <Building2 size={26} />
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              title={t("admin.edit")}
              className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={onDelete}
              title={t("admin.delete")}
              className="grid size-8 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Code + name */}
        <div className="mb-5 space-y-1">
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-widest text-gold"
            dir="ltr"
          >
            {f.code}
          </span>
          <h3
            onClick={onDetails}
            className="cursor-pointer font-serif text-lg font-bold text-forest transition hover:text-gold"
          >
            {f.name}
          </h3>

          {/*
            الأعداد تقول كم، ولا تقول أين انقطعت السلسلة. وهذا الوسم يقولها:
            الموضوع يطلب تخصّصاً، فشعبةٌ بلا تخصّص وقسمٌ بلا شعبة فراغاتٌ
            تمنع الاستعمال وإن بدا العدّاد عامراً.
          */}
          {gaps && hasGap(gaps) && (
            <div className="pt-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold text-forest">
                <TriangleAlert size={12} className="shrink-0 text-gold" />
                {gaps.noDept
                  ? t("admin.gapNoDepartments")
                  : t("admin.needsCompletion")}
              </span>
              {!gaps.noDept && (
                <p className="mt-1 text-[11px] leading-relaxed text-clay">
                  {[
                    gaps.deptNoFiliere > 0 &&
                      t("admin.gapDeptNoFiliere", {
                        count: gaps.deptNoFiliere,
                      }),
                    gaps.filiereNoSpec > 0 &&
                      t("admin.gapFiliereNoSpec", {
                        count: gaps.filiereNoSpec,
                      }),
                  ]
                    .filter(Boolean)
                    .join(" \u00b7 ")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-y-4 border-y border-forest/10 py-5">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`text-center ${
                i % 2 === 0 ? "border-l border-forest/10" : ""
              }`}
            >
              <p className="mb-1 text-[11px] text-clay">{s.label}</p>
              <p className="font-serif text-lg font-bold text-forest">
                {pad2(s.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <button
        onClick={onDetails}
        className="mt-auto flex items-center justify-end gap-2 bg-cream-2 px-5 py-4 text-sm font-bold text-forest transition hover:text-gold"
      >
        {t("admin.viewDetails")}
        <ChevronLeft
          size={16}
          className="transition rtl:group-hover:-translate-x-1 ltr:group-hover:translate-x-1 ltr:rotate-180"
        />
      </button>
    </div>
  );
}

/* ── حالة فارغة ─────────────────────────────────────────────── */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 grid size-28 place-items-center rounded-full bg-cream-card shadow-sm">
        <GraduationCap size={56} className="text-clay/40" />
      </div>
      <h2 className="font-serif text-2xl font-bold text-forest">
        {t("admin.noFaculties")}
      </h2>
      <p className="mx-auto mb-8 mt-2 max-w-xs text-sm text-clay">
        {t("admin.noFacultiesHint")}
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-8 py-3 text-sm font-bold text-forest-deep shadow-sm transition hover:bg-gold-soft"
      >
        <Plus size={18} />
        {t("admin.addFaculty")}
      </button>
    </div>
  );
}
