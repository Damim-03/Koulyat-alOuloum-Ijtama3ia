import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AlignRight,
  BadgeCheck,
  Eye,
  FileSignature,
  GraduationCap,
  Heading1,
  History,
  Info,
  Lock,
  PenLine,
  RotateCcw,
  Rows3,
  Type,
} from "lucide-react";
import {
  useAdminSupervisionSheet,
  useResetSupervisionSheet,
  useSaveSupervisionSheet,
} from "../../hooks/site-content-hook";
import { Field, inputClass } from "../../components/form/form-dialog";
import { CoverImageField } from "../../components/form/cover-image-field";
import { ConfirmDialog } from "../../components/form/confirm-dialog.form";
import { VisibilityToggle } from "../../components/dialog/home-slide/slide-parts";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { SupervisionSheet } from "../../../supervision/components/supervision-sheet";
import { SheetPreviewFrame } from "../../../supervision/components/sheet-preview-frame";
import {
  SHEET_DEGREES,
  type SheetDegree,
  type SupervisionTemplate,
} from "../../../supervision/lib/sheet-template";
import type { SupervisionSnapshot } from "../../../supervision/api/supervision.api";
import { SPEC_LEVEL_LABEL } from "../../../../lib/spec-level";
import { PanelBar, StatChip } from "./panel-kit";
import { ListEditor, SaveActions, UnsavedBar } from "./content-kit";
import { useUnsavedWarning } from "./content-utils";

/** The sentences of the sheet, in the order it prints them — and the server's limits. */
type Line =
  | "title"
  | "supervisorLead"
  | "topicLead"
  | "degreeLead"
  | "studentsLead"
  | "studentLabel"
  | "yearLabel"
  | "signLabel";
const LINES: { key: Line; max: number; icon: typeof Type; hint?: boolean }[] = [
  { key: "title", max: 120, icon: Heading1 },
  { key: "supervisorLead", max: 200, icon: AlignRight, hint: true },
  { key: "topicLead", max: 200, icon: AlignRight, hint: true },
  { key: "degreeLead", max: 120, icon: AlignRight, hint: true },
  { key: "studentsLead", max: 200, icon: AlignRight, hint: true },
  { key: "studentLabel", max: 60, icon: Type, hint: true },
  { key: "yearLabel", max: 60, icon: Type, hint: true },
  { key: "signLabel", max: 80, icon: PenLine },
];
const HEADER_MAX = 6;
/**
 * The preview's width from the screen's height: an A4 page is 1 : √2, and
 * about 15rem goes to the header, the preview's own bar, padding and note.
 */
const PREVIEW_MAX_WIDTH = "max(380px, calc((100svh - 15rem) * 0.7071))";

/** As the server stores it: every text trimmed, blank header lines dropped, a removed logo `null`. */
const clean = (d: SupervisionTemplate): SupervisionTemplate => ({
  header: d.header.map((l) => l.trim()).filter(Boolean),
  department: { show: d.department.show, prefix: d.department.prefix.trim() },
  title: d.title.trim(),
  supervisorLead: d.supervisorLead.trim(),
  topicLead: d.topicLead.trim(),
  degreeLead: d.degreeLead.trim(),
  degrees: {
    licence: d.degrees.licence.trim(),
    master: d.degrees.master.trim(),
    doctorate: d.degrees.doctorate.trim(),
  },
  specialization: {
    show: d.specialization?.show ?? true,
    label: (d.specialization?.label ?? "").trim(),
  },
  studentsLead: d.studentsLead.trim(),
  studentLabel: d.studentLabel.trim(),
  yearLabel: d.yearLabel.trim(),
  signLabel: d.signLabel.trim(),
  universityLogo: d.universityLogo || null,
  facultyLogo: d.facultyLogo || null,
});
const sameAs = (a: SupervisionTemplate, b: SupervisionTemplate) =>
  JSON.stringify(clean(a)) === JSON.stringify(clean(b));

/** The academic year a sheet issued today would carry: from September on, the one that starts. */
function currentYear(now = new Date()) {
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

/**
 * The preview's sample: what a topic fills in when the sheet is issued. In
 * Arabic, as the sheet itself — it never prints in another language.
 */
const sample = (template: SupervisionTemplate, level: SheetDegree): SupervisionSnapshot => ({
  topicTitle: "عنوان المذكّرة كما سُجّل في الموضوع",
  supervisorName: "اسم الأستاذ المشرف",
  level,
  academicYear: currentYear(),
  specialization: "علم الاجتماع",
  students: [
    { fullName: "اسم الطالب الأوّل", registrationNumber: "000000000001" },
    { fullName: "اسم الطالب الثاني", registrationNumber: "000000000002" },
  ],
  issuedAt: "",
  template,
});

/**
 * تبويب «ورقة الإشراف» في «واجهة الموقع»: نصُّ ورقة «طلب الموافقة على
 * الإشراف» وشعاراها — الترويسة، وسطر القسم، والعنوان، وكلّ عبارة، وأسماء
 * الشهادات — ومعاينتُها كما ستُطبع، تتبع الكتابة.
 *
 * وكلّ حقلٍ اختياريّ: ما يُترك فارغاً لا يُطبع.
 *
 * وما يُحفظ يسري على ما يصدر بعده وحده: كلّ وثيقةٍ تحمل نصّها منذ صدورها.
 * و«استعادة الأصل» تمحو المحفوظ فتعود الورقة إلى نصّها الأوّل.
 */
export function SupervisionSheetPanel() {
  const { data, isLoading, isError, refetch } = useAdminSupervisionSheet();
  if (isLoading) return <LoadingArea className="py-20" />;
  if (isError || !data) return <ErrorRetry onRetry={() => refetch()} />;
  return <SheetForm saved={data.content} defaults={data.defaults} />;
}

function SheetForm({ saved, defaults }: { saved: SupervisionTemplate | null; defaults: SupervisionTemplate }) {
  const { t } = useTranslation();
  const save = useSaveSupervisionSheet();
  const reset = useResetSupervisionSheet();

  const [draft, setDraft] = useState<SupervisionTemplate>(() => saved ?? defaults);
  const [baseline, setBaseline] = useState(() => clean(saved ?? defaults));
  const [confirmReset, setConfirmReset] = useState(false);
  const [previewLevel, setPreviewLevel] = useState<SheetDegree>("master");

  const dirty = !sameAs(draft, baseline);
  const original = sameAs(draft, defaults);
  useUnsavedWarning(dirty);

  const notPrinted = t("admin.supSheet.notPrinted");
  // The specialization line under the degrees: on, with its label, unless turned off.
  const spec = draft.specialization ?? { show: true, label: "" };

  const set = <K extends keyof SupervisionTemplate>(k: K, v: SupervisionTemplate[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function adopt(next: SupervisionTemplate) {
    setDraft(next);
    setBaseline(clean(next));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = clean(draft);
    save.mutate(payload, { onSuccess: (r) => adopt(r.content ?? r.defaults) });
  }

  function restore() {
    reset.mutate(undefined, {
      onSuccess: (r) => {
        adopt(r.defaults);
        setConfirmReset(false);
      },
    });
  }

  const saveLabel = t("admin.supSheet.save");
  const actions = (
    <>
      <button
        type="button"
        onClick={() => setConfirmReset(true)}
        disabled={!saved || reset.isPending}
        title={saved ? undefined : t("admin.supSheet.restoreNone")}
        data-testid="sup-sheet-restore"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-forest/15 px-3 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-45 disabled:hover:bg-transparent"
      >
        <RotateCcw size={15} />
        {t("admin.supSheet.restore")}
      </button>
      <SaveActions dirty={dirty} saving={save.isPending} onUndo={() => adopt(baseline)} saveLabel={saveLabel} />
    </>
  );

  return (
    <form onSubmit={handleSubmit} data-testid="sup-sheet-panel">
      <PanelBar
        icon={FileSignature}
        title={t("admin.supSheet.title")}
        hint={t("admin.supSheet.subtitle")}
        stats={
          <span data-testid="sup-sheet-status">
            {saved ? (
              <StatChip icon={BadgeCheck} label={t("admin.supSheet.statusCustom")} tone="good" />
            ) : (
              <StatChip icon={History} label={t("admin.supSheet.statusOriginal")} tone="muted" />
            )}
          </span>
        }
        actions={actions}
      />

      <p className="mb-5 flex items-start gap-2.5 rounded-2xl border border-gold/30 bg-gold/8 px-4 py-3 text-[12.5px] leading-relaxed text-forest/85">
        <Lock size={15} className="mt-0.5 shrink-0 text-gold" />
        {t("admin.supSheet.frozenNote")}
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
        <section className="min-w-0 space-y-6 rounded-2xl border border-forest/10 bg-cream-card p-5 shadow-sm">
          {/* ── الترويسة ── */}
          <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
            <legend className="px-1.5 text-sm font-bold text-forest">{t("admin.supSheet.groupHeader")}</legend>
            <p className="-mt-2 text-[11.5px] text-clay">{t("admin.supSheet.groupHeaderHint")}</p>
            <ListEditor
              label={t("admin.supSheet.headerLines")}
              icon={Rows3}
              items={draft.header}
              onChange={(header) => set("header", header)}
              max={HEADER_MAX}
              make={() => ""}
              addLabel={t("admin.supSheet.addLine")}
              empty={t("admin.supSheet.headerEmpty")}
              render={(line, update, i) => (
                <input
                  dir="rtl"
                  value={line}
                  maxLength={140}
                  onChange={(e) => update(e.target.value)}
                  aria-label={t("admin.supSheet.headerLine", { n: i + 1 })}
                  placeholder={notPrinted}
                  className={inputClass}
                />
              )}
            />

            <VisibilityToggle
              on={draft.department.show}
              onChange={(show) => set("department", { ...draft.department, show })}
              labels={{
                on: t("admin.supSheet.deptOn"),
                off: t("admin.supSheet.deptOff"),
                onHint: t("admin.supSheet.deptOnHint"),
                offHint: t("admin.supSheet.deptOffHint"),
              }}
            />
            {draft.department.show && (
              <Field label={t("admin.supSheet.deptPrefix")} icon={Type} hint={t("admin.supSheet.deptPrefixHint")}>
                <input
                  dir="rtl"
                  value={draft.department.prefix}
                  maxLength={40}
                  onChange={(e) => set("department", { ...draft.department, prefix: e.target.value })}
                  aria-label={t("admin.supSheet.deptPrefix")}
                  className={inputClass}
                />
              </Field>
            )}
          </fieldset>

          {/* ── الشعاران ── */}
          <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
            <legend className="px-1.5 text-sm font-bold text-forest">{t("admin.supSheet.groupLogos")}</legend>
            <p className="-mt-2 text-[11.5px] text-clay">{t("admin.supSheet.groupLogosHint")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <CoverImageField
                variant="icon"
                label={t("admin.supSheet.universityLogo")}
                hint={t("admin.supSheet.universityLogoHint")}
                value={draft.universityLogo}
                onChange={(url) => set("universityLogo", url || null)}
              />
              <CoverImageField
                variant="icon"
                label={t("admin.supSheet.facultyLogo")}
                hint={t("admin.supSheet.facultyLogoHint")}
                value={draft.facultyLogo}
                onChange={(url) => set("facultyLogo", url || null)}
              />
            </div>
          </fieldset>

          {/* ── عبارات الورقة ── */}
          <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
            <legend className="px-1.5 text-sm font-bold text-forest">{t("admin.supSheet.groupTexts")}</legend>
            <p className="-mt-2 text-[11.5px] text-clay">{t("admin.supSheet.groupTextsHint")}</p>
            {LINES.map(({ key, max, icon, hint }) => (
              <Field
                key={key}
                label={t(`admin.supSheet.f.${key}`)}
                icon={icon}
                hint={hint ? t(`admin.supSheet.f.${key}Hint`) : undefined}
              >
                <input
                  dir="rtl"
                  value={draft[key]}
                  maxLength={max}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder={notPrinted}
                  aria-label={t(`admin.supSheet.f.${key}`)}
                  className={inputClass}
                />
              </Field>
            ))}
          </fieldset>

          {/* ── الشهادات ── */}
          <fieldset className="space-y-4 rounded-2xl border border-forest/10 p-4">
            <legend className="px-1.5 text-sm font-bold text-forest">{t("admin.supSheet.groupDegrees")}</legend>
            <p className="-mt-2 text-[11.5px] text-clay">{t("admin.supSheet.groupDegreesHint")}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {SHEET_DEGREES.map((d) => (
                <Field key={d} label={t(SPEC_LEVEL_LABEL[d])} icon={GraduationCap}>
                  <input
                    dir="rtl"
                    value={draft.degrees[d]}
                    maxLength={60}
                    onChange={(e) => set("degrees", { ...draft.degrees, [d]: e.target.value })}
                    placeholder={notPrinted}
                    aria-label={t(SPEC_LEVEL_LABEL[d])}
                    className={inputClass}
                  />
                </Field>
              ))}
            </div>

            {/* Under the boxes: the topic's specialization. */}
            <VisibilityToggle
              on={spec.show}
              onChange={(show) => set("specialization", { ...spec, show })}
              labels={{
                on: t("admin.supSheet.specOn"),
                off: t("admin.supSheet.specOff"),
                onHint: t("admin.supSheet.specOnHint"),
                offHint: t("admin.supSheet.specOffHint"),
              }}
            />
            {spec.show && (
              <Field label={t("admin.supSheet.specLabel")} icon={Type} hint={t("admin.supSheet.specLabelHint")}>
                <input
                  dir="rtl"
                  value={spec.label}
                  maxLength={60}
                  onChange={(e) => set("specialization", { ...spec, label: e.target.value })}
                  placeholder={notPrinted}
                  aria-label={t("admin.supSheet.specLabel")}
                  className={inputClass}
                />
              </Field>
            )}
          </fieldset>
        </section>

        {/* ── المعاينة: الورقة نفسها، تتبع الكتابة ── */}
        {/*
          Beside the form while it scrolls: under the sticky header (h-16),
          never taller than the screen — what does not fit scrolls inside.
        */}
        <aside className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100svh-6rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:rounded-2xl">
          <div className="overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-forest/10 px-4 py-3">
              <span className="flex items-center gap-2">
                <Eye size={16} className="text-gold" />
                <b className="text-sm text-forest">{t("admin.supSheet.previewTitle")}</b>
                {original && (
                  <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[10.5px] font-bold text-clay" data-testid="sup-sheet-original">
                    {t("admin.supSheet.matchesOriginal")}
                  </span>
                )}
              </span>
              <span role="radiogroup" aria-label={t("admin.supSheet.previewLevel")} className="inline-flex rounded-lg bg-forest/6 p-0.5">
                {SHEET_DEGREES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={previewLevel === d}
                    onClick={() => setPreviewLevel(d)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                      previewLevel === d ? "bg-cream-card text-forest shadow-sm" : "text-clay hover:text-forest"
                    }`}
                  >
                    {t(SPEC_LEVEL_LABEL[d])}
                  </button>
                ))}
              </span>
            </div>
            <div className="bg-clay/12 p-4">
              {/* The whole A4 page in view where the screen allows it, never under a readable 380px. */}
              <div className="mx-auto" style={{ maxWidth: PREVIEW_MAX_WIDTH }}>
                <SheetPreviewFrame>
                  <SupervisionSheet
                    snapshot={sample(clean(draft), previewLevel)}
                    documentNumber={t("supervision.draftNumber")}
                    barcode={null}
                  />
                </SheetPreviewFrame>
              </div>
            </div>
            <p className="flex items-start gap-2 px-4 py-3 text-[11.5px] leading-relaxed text-clay">
              <Info size={13} className="mt-0.5 shrink-0" />
              {t("admin.supSheet.previewHint")}
            </p>
          </div>
        </aside>
      </div>

      <UnsavedBar dirty={dirty} saving={save.isPending} onUndo={() => adopt(baseline)} saveLabel={saveLabel} />

      <ConfirmDialog
        open={confirmReset}
        tone="danger"
        icon={RotateCcw}
        title={t("admin.supSheet.restoreTitle")}
        message={t("admin.supSheet.restoreMessage")}
        confirmLabel={t("admin.supSheet.restoreConfirm")}
        loading={reset.isPending}
        onConfirm={restore}
        onClose={() => setConfirmReset(false)}
      />
    </form>
  );
}
