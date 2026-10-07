import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Building2,
  CalendarRange,
  ChevronLeft,
  Download,
  FileDown,
  GitBranch,
  GraduationCap,
  Landmark,
  Layers,
  Loader2,
  RotateCcw,
  Sheet,
  Table2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useAcademicYears,
  useDepartments,
  useFaculties,
  useFilieres,
  useSpecializations,
  useStudents,
} from "../../../hooks/admin-hook";
import { adminApi } from "../../../api/admin.api";
import { Select } from "../../../../../components/ui/select";
import { useBodyScrollLock } from "../../../../../hooks/use-body-scroll-lock";
import { downloadBlob } from "../../../../../lib/download";
import { SPEC_LEVEL_KEY, SPEC_LEVELS, type SpecLevel } from "../user/user-form-steps";

/** فلاتر الصفحة لحظة الفتح — ما يراه المسؤول في الجدول هو ما يبدأ منه. */
export interface StudentExportFilters {
  facultyId: string;
  departmentId: string;
  filiereId: string;
  level: SpecLevel | "";
  specializationId: string;
}

type Layout = "bySpecialization" | "single";
/** الخانة التي لا قيمة لها: «لا يوجد»، أو فارغةٌ لتعمل التعبئة السريعة في Excel. */
type Empty = "none" | "blank";

interface Props {
  open: boolean;
  onClose: () => void;
  initial: StudentExportFilters;
}

/**
 * استخراج قوائم الطلبة إلى Excel.
 *
 * الفلاتر بترتيب الهيكل الأكاديميّ: السنة الجامعية، ثمّ الكلية ← القسم ←
 * الشعبة ← المستوى ← التخصص — كلٌّ يضيّق ما بعده. واختيار ما هو أدنى يملأ ما
 * فوقه: من اختار تخصصاً عرف كليته وقسمه وشعبته ومستواه.
 *
 * والعدد يُحسب حيّاً بالفلاتر نفسها التي يقرؤها الخادم عند التصدير، فلا
 * يُنزَّل ملفٌّ فارغ.
 */
export function StudentExportDialog(props: Props) {
  if (!props.open) return null;
  return <ExportDialog {...props} />;
}

function ExportDialog({ onClose, initial }: Props) {
  const { t } = useTranslation();
  const tt = (k: string, o?: Record<string, unknown>) => t(`admin.export.${k}`, o);
  useBodyScrollLock(true);

  const { data: years } = useAcademicYears();
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();

  // null = لم يُختر بعد ⇒ السنة الجارية؛ "" = كلّ السنوات.
  const [yearChoice, setYearChoice] = useState<string | null>(null);
  const [facultyId, setFacultyId] = useState(initial.facultyId);
  const [departmentId, setDepartmentId] = useState(initial.departmentId);
  const [filiereId, setFiliereId] = useState(initial.filiereId);
  const [level, setLevel] = useState<SpecLevel | "">(initial.level);
  const [specializationId, setSpecializationId] = useState(initial.specializationId);
  const [layout, setLayout] = useState<Layout>("bySpecialization");
  const [empty, setEmpty] = useState<Empty>("none");
  const [busy, setBusy] = useState(false);

  const activeYear = (years ?? []).find((y) => y.isActive && !y.archivedAt);
  const academicYearId = yearChoice ?? activeYear?.id ?? "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  // ── الخيارات، كلٌّ مضيَّقٌ بما فوقه ──
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const deptOf = (id?: string) => (departments ?? []).find((d: any) => d.id === id) as any;
  const filiereOf = (id?: string) => (filieres ?? []).find((f: any) => f.id === id) as any;
  // التخصص يعرف شعبته، والشعبة تعرف قسمها — `departmentId` على التخصص بقيّةٌ
  // قديمة لا تُملأ.
  const specDept = (s: any): string | undefined =>
    s.departmentId ?? s.filiere?.departmentId ?? filiereOf(s.filiereId)?.departmentId;
  const deptOptions = useMemo(
    () => (departments ?? []).filter((d: any) => !facultyId || d.facultyId === facultyId),
    [departments, facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter((f: any) => {
        if (departmentId) return f.departmentId === departmentId;
        if (facultyId) return deptOf(f.departmentId)?.facultyId === facultyId;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filieres, departmentId, facultyId, departments],
  );
  const specOptions = useMemo(
    () =>
      (specs ?? []).filter((s: any) => {
        if (level && s.level !== level) return false;
        if (filiereId) return s.filiereId === filiereId;
        if (departmentId) return specDept(s) === departmentId;
        if (facultyId) return deptOf(specDept(s))?.facultyId === facultyId;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [specs, level, filiereId, departmentId, facultyId, departments, filieres],
  );

  // ── الاختيار: ما تحته يُفرَّغ، وما فوقه يُملأ منه ──
  function pickFaculty(v: string) {
    setFacultyId(v);
    setDepartmentId("");
    setFiliereId("");
    setSpecializationId("");
  }
  function pickDepartment(v: string) {
    setDepartmentId(v);
    if (v) setFacultyId(deptOf(v)?.facultyId ?? facultyId);
    setFiliereId("");
    setSpecializationId("");
  }
  function pickFiliere(v: string) {
    setFiliereId(v);
    if (v) {
      const f = filiereOf(v);
      if (f) {
        setDepartmentId(f.departmentId);
        setFacultyId(deptOf(f.departmentId)?.facultyId ?? facultyId);
      }
    }
    setSpecializationId("");
  }
  function pickLevel(v: SpecLevel | "") {
    setLevel(v);
    const s = (specs ?? []).find((x: any) => x.id === specializationId) as any;
    if (v && s && s.level !== v) setSpecializationId("");
  }
  function pickSpecialization(v: string) {
    setSpecializationId(v);
    const s = (specs ?? []).find((x: any) => x.id === v) as any;
    if (!s) return;
    const dept = specDept(s);
    setLevel(s.level);
    setFiliereId(s.filiereId ?? "");
    setDepartmentId(dept ?? "");
    setFacultyId(deptOf(dept)?.facultyId ?? facultyId);
  }
  function clearAll() {
    pickFaculty("");
    setLevel("");
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const params = {
    academicYearId: academicYearId || undefined,
    facultyId: facultyId || undefined,
    departmentId: departmentId || undefined,
    filiereId: filiereId || undefined,
    level: level || undefined,
    specializationId: specializationId || undefined,
  };
  // العدد بالفلاتر نفسها التي يقرؤها التصدير.
  const { data: counted, isFetching } = useStudents({ ...params, page: 1, limit: 1 });
  const count = counted?.total;

  const nameOf = (list: { id: string; name: string }[] | undefined, id: string) =>
    list?.find((x) => x.id === id)?.name;
  const scope = [
    nameOf(faculties as never, facultyId),
    nameOf(departments as never, departmentId),
    nameOf(filieres as never, filiereId),
    level ? t(SPEC_LEVEL_KEY[level]) : undefined,
    nameOf(specs as never, specializationId),
  ].filter(Boolean) as string[];
  const yearTitle = (years ?? []).find((y) => y.id === academicYearId)?.title;

  const columns = [
    tt("colReg"),
    tt("colLatin"),
    tt("colArabic"),
    tt("colGender"),
    tt("colContact"),
    t("admin.facultyLabel"),
    t("admin.department"),
    t("admin.filiere"),
    t("admin.specializationLevel"),
    t("admin.specialization"),
    ...(academicYearId ? [] : [tt("colYear")]),
  ];

  async function download() {
    setBusy(true);
    try {
      const blob = await adminApi.exportStudents({ ...params, layout, empty });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, tt("fileName", { date }));
      toast.success(tt("done", { count: count ?? 0 }));
      onClose();
    } catch (e) {
      // جوابُ الخطأ نفسه blob: يُقرأ نصّاً لتظهر رسالة الخادم.
      let message = tt("failed");
      const data = (e as { response?: { data?: unknown } })?.response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text()).message ?? message;
        } catch {
          /* keep the generic message */
        }
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const levelChoices = SPEC_LEVELS.map((lv) => ({ value: lv, label: t(SPEC_LEVEL_KEY[lv]) }));

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-3 font-body sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-title"
    >
      <div onClick={() => !busy && onClose()} className="absolute inset-0 bg-forest-deep/60 backdrop-blur-md" />

      <div className="animate-scale-in relative flex max-h-[94vh] w-full max-w-[min(96vw,1080px)] flex-col overflow-hidden rounded-[28px] border border-gold/20 bg-cream-card shadow-[0_40px_120px_-30px_rgba(10,20,17,0.75)] ring-1 ring-black/5">
        {/* ── الرأس ── */}
        <header className="forest-glow relative shrink-0 overflow-hidden px-7 py-5 text-cream">
          <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
          <div aria-hidden className="pointer-events-none absolute -top-24 start-1/3 size-64 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold text-[var(--t-brand-deep)] shadow-[0_10px_28px_rgba(193,150,90,0.45)] ring-1 ring-white/30">
              <FileDown size={27} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-[0.18em] text-gold-soft/90 uppercase">{tt("kicker")}</p>
              <h3 id="export-title" className="truncate font-serif text-2xl font-bold">
                {tt("title")}
              </h3>
              <p className="text-xs text-cream/70">{tt("subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={tt("close")}
              className="grid size-10 shrink-0 place-items-center rounded-xl text-cream/80 ring-1 ring-cream/15 transition hover:bg-cream/15 hover:text-cream disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-linear-to-l from-gold via-gold-soft to-gold" />
        </header>

        {/* ── الجسم ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            {/* ١ — من؟ */}
            <section className="rounded-3xl border border-forest/10 bg-linear-to-bl from-gold/8 via-cream-card to-cream-card p-5 shadow-[0_10px_30px_-18px_rgba(38,66,61,0.35)]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <StepBadge n={1} />
                  <div>
                    <h4 className="font-serif text-lg font-bold text-forest">{tt("whoTitle")}</h4>
                    <p className="text-xs text-clay">{tt("whoHint")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
                >
                  <RotateCcw size={13} />
                  {tt("clear")}
                </button>
              </div>

              <Field icon={CalendarRange} label={tt("year")}>
                <Select
                  value={academicYearId}
                  onChange={(v) => setYearChoice(v)}
                  aria-label={tt("year")}
                  options={[
                    { value: "", label: tt("allYears") },
                    ...(years ?? []).map((y) => ({
                      value: y.id,
                      label: y.isActive ? `${y.title} — ${tt("current")}` : y.title,
                    })),
                  ]}
                />
              </Field>

              {/* الهرم: خطٌّ يصل الدرجات، كلٌّ يضيّق ما تحته */}
              <ol className="relative mt-4 space-y-3 ps-6">
                <span aria-hidden className="absolute inset-y-3 start-[9px] w-px bg-linear-to-b from-gold/60 via-forest/15 to-gold/60" />
                <Rung icon={Landmark} label={t("admin.facultyLabel")}>
                  <Select
                    value={facultyId}
                    onChange={pickFaculty}
                    aria-label={t("admin.facultyLabel")}
                    options={[{ value: "", label: t("admin.allFacultiesShort") }, ...opts(faculties)]}
                  />
                </Rung>
                <Rung icon={Building2} label={t("admin.department")}>
                  <Select
                    value={departmentId}
                    onChange={pickDepartment}
                    aria-label={t("admin.department")}
                    options={[{ value: "", label: t("admin.allDepartments") }, ...opts(deptOptions)]}
                  />
                </Rung>
                <Rung icon={GitBranch} label={t("admin.filiere")}>
                  <Select
                    value={filiereId}
                    onChange={pickFiliere}
                    aria-label={t("admin.filiere")}
                    options={[{ value: "", label: t("admin.allFilieresShort") }, ...opts(filiereOptions)]}
                  />
                </Rung>
                <Rung icon={Layers} label={t("admin.specializationLevel")}>
                  <Select
                    value={level}
                    onChange={(v) => pickLevel(v as SpecLevel | "")}
                    aria-label={t("admin.specializationLevel")}
                    options={[{ value: "", label: t("admin.allLevels") }, ...levelChoices]}
                  />
                </Rung>
                <Rung icon={GraduationCap} label={t("admin.specialization")}>
                  <Select
                    value={specializationId}
                    onChange={pickSpecialization}
                    aria-label={t("admin.specialization")}
                    options={[{ value: "", label: t("admin.allSpecializations") }, ...opts(specOptions)]}
                  />
                </Rung>
              </ol>
            </section>

            {/* ٢ — كيف؟ وكم؟ */}
            <div className="flex flex-col gap-5">
              <section className="rounded-3xl border border-forest/10 bg-cream-card p-5 shadow-[0_10px_30px_-18px_rgba(38,66,61,0.35)]">
                <div className="mb-4 flex items-center gap-3">
                  <StepBadge n={2} />
                  <h4 className="font-serif text-lg font-bold text-forest">{tt("howTitle")}</h4>
                </div>
                <div role="radiogroup" aria-label={tt("howTitle")} className="grid gap-2.5">
                  <LayoutCard
                    icon={Sheet}
                    title={tt("layoutBySpec")}
                    hint={tt("layoutBySpecHint")}
                    on={layout === "bySpecialization"}
                    onPick={() => setLayout("bySpecialization")}
                  />
                  <LayoutCard
                    icon={Table2}
                    title={tt("layoutSingle")}
                    hint={tt("layoutSingleHint")}
                    on={layout === "single"}
                    onPick={() => setLayout("single")}
                  />
                </div>

                {/* الخانات الفارغة: التعبئة السريعة (Ctrl+E) لا تملأ إلّا الفارغ */}
                <p className="mb-2 mt-5 text-xs font-semibold text-forest/80">{tt("emptyTitle")}</p>
                <div role="radiogroup" aria-label={tt("emptyTitle")} className="grid grid-cols-2 gap-2">
                  {(["none", "blank"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={empty === v}
                      onClick={() => setEmpty(v)}
                      className={`rounded-xl border px-3 py-2.5 text-start transition ${
                        empty === v ? "border-gold/60 bg-gold/10" : "border-forest/12 hover:border-forest/25"
                      }`}
                    >
                      <b className="block text-[13px] text-forest">{tt(v === "none" ? "emptyNone" : "emptyBlank")}</b>
                      <span className="mt-0.5 block text-[11px] leading-snug text-clay">
                        {tt(v === "none" ? "emptyNoneHint" : "emptyBlankHint")}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section
                className="relative overflow-hidden rounded-3xl bg-forest-deep p-5 text-cream shadow-[0_18px_40px_-20px_rgba(10,20,17,0.8)]"
                style={{ backgroundColor: "var(--t-brand-deep)" }}
              >
                <div aria-hidden className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />
                <div className="relative">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold-soft">
                    <Users size={13} />
                    {tt("inFile")}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 font-serif text-3xl font-bold" aria-live="polite" data-testid="export-count">
                    {count === undefined || isFetching ? (
                      <Loader2 size={24} className="animate-spin text-gold-soft" />
                    ) : (
                      tt("count", { count })
                    )}
                  </p>
                  <p className="mt-1 text-xs text-white/70">{yearTitle ? tt("ofYear", { year: yearTitle }) : tt("allYears")}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    {scope.length === 0 ? (
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/85">{tt("scopeAll")}</span>
                    ) : (
                      scope.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[11px] text-white/85">
                          {i > 0 && <ChevronLeft size={12} className="text-gold-soft/70 ltr:rotate-180" />}
                          <span className="rounded-full bg-white/10 px-2.5 py-1">{s}</span>
                        </span>
                      ))
                    )}
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="mb-2 text-[11px] font-semibold text-white/60">{tt("columnsTitle")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {columns.map((c) => (
                        <span key={c} className="rounded-md bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold-soft">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* ── التذييل ── */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/60 px-7 py-4">
          <p className="text-xs text-clay">{tt("footerHint")}</p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-50"
            >
              {tt("cancel")}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={busy || !count}
              data-testid="export-download"
              className="inline-flex items-center gap-2 rounded-xl bg-linear-to-br from-gold to-gold-soft px-6 py-2.5 text-sm font-bold text-[#1a312d] shadow-[0_10px_24px_-10px_rgba(193,150,90,0.8)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
              {busy ? tt("downloading") : tt("download")}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

const opts = (list: unknown) =>
  ((list ?? []) as { id: string; name: string }[]).map((x) => ({ value: x.id, label: x.name }));

function StepBadge({ n }: { n: number }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-gold-soft to-gold font-serif text-sm font-bold text-[var(--t-brand-deep)] shadow-[0_6px_16px_-6px_rgba(193,150,90,0.8)]">
      {n}
    </span>
  );
}

function Field({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-forest/80">
        <Icon size={14} className="text-gold" />
        {label}
      </span>
      {children}
    </label>
  );
}

/** درجةٌ في الهرم: نقطةٌ على الخطّ، وعنوانها، وقائمتها. */
function Rung({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <li className="relative">
      <span aria-hidden className="absolute -start-6 top-[30px] grid size-[19px] place-items-center rounded-full border border-gold/50 bg-cream-card">
        <span className="size-1.5 rounded-full bg-gold" />
      </span>
      <label className="block">
        <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-clay">
          <Icon size={13} className="text-forest/60" />
          {label}
        </span>
        {children}
      </label>
    </li>
  );
}

function LayoutCard({
  icon: Icon,
  title,
  hint,
  on,
  onPick,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-start transition ${
        on ? "border-gold/60 bg-gold/10 shadow-[0_8px_20px_-14px_rgba(193,150,90,0.9)]" : "border-forest/12 hover:border-forest/25 hover:bg-forest/3"
      }`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? "bg-gold/20 text-gold" : "bg-forest/6 text-clay"}`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm text-forest">{title}</b>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-clay">{hint}</span>
      </span>
      <span
        aria-hidden
        className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border ${on ? "border-gold bg-gold" : "border-forest/25"}`}
      >
        {on && <span className="size-1.5 rounded-full bg-white" />}
      </span>
    </button>
  );
}
