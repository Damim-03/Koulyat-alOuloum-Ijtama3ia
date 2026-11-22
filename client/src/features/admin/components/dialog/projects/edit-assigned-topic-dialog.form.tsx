import { useCallback, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { capPayload, readCap, type CapValue } from "../../../lib/request-cap";
import {
  X,
  FileText,
  Save,
  UserPlus,
  SendHorizontal,
  Loader2,
  ChevronLeft,
} from "lucide-react";

import {
  useUpdateAssignedTopic,
  useAdminTopic,
  useProfessors,
  useFaculties,
  useDepartments,
  useFilieres,
  useSpecializations,
  useAcademicYears,
} from "../../../hooks/admin-hook";
import { ProfessorPicker } from "../../ui/professor-picker";
import { ListInput } from "../../../../../components/ui/list-input";
import { statusChip } from "../../../utils/status-styles";
import {
  inputCls,
  SectionHead,
  Field,
  ReviewRow,
} from "../../../../../components/ui/form-bits";
import { Stepper } from "../../../../../components/ui/stepper";
import {
  StudentSeat,
  type SeatStudent,
} from "../../ui/student-seat";
import { Select } from "../../../../../components/ui/select";
import { LoadingArea } from "../../../../../components/ui/loading-area";
import { personName } from "../../../../../lib/person-name";
import { TopicExtrasFields } from "../../../../../components/topic/topic-extras-fields";
import { extrasOf, extrasPayload } from "../../../../../lib/topic-extras";
import { levelName } from "../../../../../lib/spec-level";
import { ruleOf, seatsFor } from "../../../../../lib/team-size";
import { TeamSizeRuled } from "../../../../../components/topic/team-size-ruled";
import { useProfessorOptions, useTopicTypeOptions } from "../../../../../hooks/use-topic-lookups";
import { TopicReviewStep, type ReviewLine } from "./topic-review-step";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Edit a topic — in one of two ways, from its page:
 *
 * - «تعديل الموضوع المسند» (`mode: "assigned"`): the topic and its students —
 *   its data, then its team, then a review to confirm.
 * - «تعديل الموضوع» (`mode: "topic"`): the topic alone — its data, then the
 *   review. Its students are not sent, so they are not touched (the server
 *   edits the team only when a member list comes with the request).
 *
 * The last step is the same in both: what changes, each field from what it
 * was to what it will be, then the topic as it will be saved; and only then
 * «تأكيد وحفظ».
 *
 * Rebuilt on the same two-step shape as the create dialog: they ask for the
 * same things, and having them look like two unrelated forms meant every
 * improvement had to be made twice — and in practice only ever was made once.
 * The shared pieces now live in ui/form-bits.
 *
 * Members are seeded from the topic endpoint, which returns the group roster,
 * so this no longer needs a second request for the project.
 */


type EditMode = "assigned" | "topic";

interface Props {
  /** The topic being edited — the dialog is open when this is not null. */
  topicId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
  /** The topic and its students (the default), or the topic alone. */
  mode?: EditMode;
}

function fullName(u: any) {
  return personName(u);
}
export function EditAssignedTopicDialog({
  topicId,
  onClose,
  onUpdated,
  mode = "assigned",
}: Props) {
  const { data: topic, isLoading } = useAdminTopic(topicId ?? "");

  if (!topicId) return null;

  // The form mounts only once the topic has arrived, so its fields are seeded
  // by useState initialisers instead of effects that sync after the fact.
  return createPortal(
    <Shell onClose={onClose} mode={mode}>
      {isLoading || !topic ? (
        <LoadingArea className="py-16" />
      ) : (
        <EditForm
          key={topicId}
          topicId={topicId}
          topic={topic as any}
          onClose={onClose}
          onUpdated={onUpdated}
          mode={mode}
        />
      )}
    </Shell>,
    document.body,
  );
}

function Shell({
  onClose,
  mode,
  children,
}: {
  onClose: () => void;
  mode: EditMode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-forest-deep/50 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-cream-card shadow-[0_20px_60px_rgba(38,66,61,0.25)]"
      >
        <div className="flex shrink-0 items-center justify-between bg-forest px-6 py-4 text-cream">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cream/10">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold">
                {t(mode === "topic" ? "admin.editTopicOnlyTitle" : "admin.editAssignedTopicTitle")}
              </h2>
              <p className="text-xs text-cream/70">
                {t(mode === "topic" ? "admin.editTopicOnlySubtitle" : "admin.editAssignedTopicSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("admin.cancel")}
            className="grid size-8 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/10"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditForm({
  topicId,
  topic,
  onClose,
  onUpdated,
  mode,
}: {
  topicId: string;
  topic: any;
  onClose: () => void;
  onUpdated?: () => void;
  mode: EditMode;
}) {
  const { t } = useTranslation();
  const updateTopic = useUpdateAssignedTopic();

  // The steps: the topic's data, its team (when it is edited here), then the review.
  const steps: ("topic" | "students" | "review")[] = mode === "topic" ? ["topic", "review"] : ["topic", "students", "review"];
  const [stepIdx, setStepIdx] = useState(0);
  const stepKey = steps[stepIdx]!;
  const goTo = (key: "topic" | "students") => setStepIdx(steps.indexOf(key));

  const [title, setTitle] = useState<string>(() => topic.title ?? "");
  const [description, setDescription] = useState<string>(
    () => topic.description ?? "",
  );
  // The number typed — used only while the year has no number of its own (lib/team-size).
  const [chosenMax, setChosenMax] = useState<number>(
    () => topic.maxStudents ?? 1,
  );
  const [maxRequests, setMaxRequests] = useState<CapValue>(
    () => topic.maxRequests ?? "",
  );
  const [professorId, setProfessorId] = useState<string>(
    () => topic.professor?.id ?? "",
  );
  const [academicYearId, setAcademicYearId] = useState<string>(
    () => topic.academicYear?.id ?? "",
  );
  const [specializationId, setSpecializationId] = useState<string>(
    () => topic.specialization?.id ?? "",
  );
  const [requirements, setRequirements] = useState<string[]>(
    () => topic.requirements ?? [],
  );
  const [objectives, setObjectives] = useState<string[]>(
    () => topic.objectives ?? [],
  );
  const [extras, setExtras] = useState(() => extrasOf(topic));

  // The cascade starts empty: every level then lists everything, so the
  // topic's existing specialization stays selectable without pre-walking
  // the hierarchy backwards.
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");

  //
  // مقعدٌ لكل طالبٍ يسمح به الموضوع — والمقاعد تُبذَر بأعضاء المجموعة
  // القائمة. و`seeded` في المقعد هو ما يمنع ضياعهم: البحث مقصورٌ على من
  // لا موضوع له، وهؤلاء لهم موضوعٌ هو هذا، فلو سُئل عنهم الخادمُ لأفرغ
  // مقاعدهم بمجرّد فتح النافذة.
  const seededMembers = useMemo<SeatStudent[]>(
    () =>
      ((topic.projectGroup?.members ?? []) as any[]).map((m) => ({
        id: m.student?.id,
        name: fullName(m.student?.user) || "—",
        reg: m.student?.registrationNumber ?? "",
        user: m.student?.user,
      })),
    [topic.projectGroup],
  );

  const [seatText, setSeatText] = useState<string[]>(() =>
    seededMembers.map((m) => m.reg),
  );
  const [seatHit, setSeatHit] = useState<(SeatStudent | null)[]>(
    () => seededMembers,
  );
  const [leaderPick, setLeaderPick] = useState<string>(
    () =>
      ((topic.projectGroup?.members ?? []) as any[]).find((m) => m.isLeader)
        ?.student?.id ?? "",
  );

  const [error, setError] = useState<string | null>(null);

  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();
  const { data: profsData } = useProfessors({ limit: 100 });
  const professors = useMemo(() => profsData?.items ?? [], [profsData]);

  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter(
        (d: any) => !facultyId || d.facultyId === facultyId,
      ),
    [departments, facultyId],
  );
  const filiereOptions = useMemo(
    () =>
      (filieres ?? []).filter((f: any) => {
        if (departmentId && f.departmentId !== departmentId) return false;
        if (facultyId && !departmentId) {
          const d = (departments ?? []).find(
            (dd: any) => dd.id === f.departmentId,
          );
          if (d && d.facultyId !== facultyId) return false;
        }
        return true;
      }),
    [filieres, departmentId, facultyId, departments],
  );
  const specOptions = useMemo(
    () =>
      (specs ?? []).filter((sp: any) => {
        if (filiereId && sp.filiereId !== filiereId) return false;
        if (
          departmentId &&
          !filiereId &&
          sp.filiere?.departmentId !== departmentId
        )
          return false;
        if (facultyId && !departmentId && !filiereId) {
          const d = (departments ?? []).find(
            (dd: any) => dd.id === sp.filiere?.departmentId,
          );
          if (d && d.facultyId !== facultyId) return false;
        }
        return true;
      }),
    [specs, filiereId, departmentId, facultyId, departments],
  );
  /** The chosen specialization's level — the topic's — shown beside it. */
  const chosenLevel = levelName((specs ?? []).find((sp: any) => sp.id === specializationId)?.level, t);
  // The number of students the administration set for the year and this level — unless the topic,
  // from before it, has more students than it: then its own number, as it is (nobody is removed).
  const teamRule = ruleOf(years, academicYearId, (specs ?? []).find((sp: any) => sp.id === specializationId)?.level);
  const maxStudents = seatsFor(teamRule, chosenMax, { members: seededMembers.length, current: topic.maxStudents ?? 1 });

  const professorName = useMemo(() => {
    const p = (professors as any[]).find((x) => x.id === professorId);
    return p ? fullName(p.user) || p.universityEmail : "";
  }, [professors, professorId]);
  const specName =
    (specs ?? []).find((s: any) => s.id === specializationId)?.name ?? "";
  const yearName =
    (years ?? []).find((y: any) => y.id === academicYearId)?.title ?? "";

  const setSeat = useCallback((i: number, text: string) => {
    setSeatText((prev) => {
      const next = prev.slice();
      while (next.length <= i) next.push("");
      next[i] = text;
      return next;
    });
  }, []);

  const resolveSeat = useCallback((i: number, student: SeatStudent | null) => {
    setSeatHit((prev) => {
      if ((prev[i]?.id ?? null) === (student?.id ?? null)) return prev;
      const next = prev.slice();
      while (next.length <= i) next.push(null);
      next[i] = student;
      return next;
    });
  }, []);

  const picked = useMemo(
    () => seatHit.slice(0, maxStudents).filter(Boolean) as SeatStudent[],
    [seatHit, maxStudents],
  );

  /** كما في حوار الإنشاء: المرسِل يُشتقّ، فلا يبقى معرَّفُ من أُخرج. */
  const leaderId = useMemo(
    () =>
      picked.some((x) => x.id === leaderPick)
        ? leaderPick
        : (picked[0]?.id ?? ""),
    [picked, leaderPick],
  );

  const step1Valid = Boolean(
    title.trim() &&
      description.trim() &&
      professorId &&
      specializationId &&
      academicYearId,
  );
  const studentsValid = picked.length >= 1 && picked.length <= maxStudents && !!leaderId;
  // The topic alone is saved without its team; the assigned topic, with it.
  const canSubmit = step1Valid && (mode === "topic" || studentsValid) && !updateTopic.isPending;
  const stepValid = stepKey === "topic" ? step1Valid : stepKey === "students" ? studentsValid : canSubmit;

  // ── the review: each field as it will be saved, and what it was ──
  const { data: typeOptions } = useTopicTypeOptions(specializationId || undefined);
  const { data: professorOptions } = useProfessorOptions();
  const coName = (id: string) => {
    if (!id) return "";
    const p = (professorOptions ?? []).find((x) => x.id === id);
    if (p) return personName(p);
    return topic.coSupervisor?.id === id ? fullName(topic.coSupervisor.user) : "";
  };
  const typeName = (id: string) => {
    if (!id) return "";
    const ty = (typeOptions ?? []).find((x) => x.id === id);
    if (ty) return `${ty.code} · ${ty.name}`;
    return topic.type?.id === id ? `${topic.type.code} · ${topic.type.name}` : "";
  };
  const before = extrasOf(topic);
  const list = (xs: string[]) => xs.filter((x) => x.trim()).join("، ");
  const cap = (v: CapValue | number | null | undefined) => (v === "" || v == null ? t("admin.maxRequestsNone") : String(v));
  const line = (key: string, label: string, after: string, was: string): ReviewLine => ({ key, label, after, before: was, changed: after !== was });
  const topicLines: ReviewLine[] = [
    line("title", t("admin.topicTitle"), title.trim(), topic.title ?? ""),
    line("description", t("admin.topicDescription"), description.trim(), (topic.description ?? "").trim()),
    line("requirements", t("admin.requirements"), list(requirements), list(topic.requirements ?? [])),
    line("objectives", t("admin.objectives"), list(objectives), list(topic.objectives ?? [])),
    line("summary", t("topicExtras.summary"), extras.summary.trim(), before.summary.trim()),
  ];
  const placementLines: ReviewLine[] = [
    line("professor", t("admin.supervisor"), professorName, fullName(topic.professor?.user) || topic.professor?.universityEmail || ""),
    line("coSupervisor", t("topicExtras.coSupervisor"), coName(extras.coSupervisorId), coName(before.coSupervisorId)),
    line("type", t("topicExtras.type"), typeName(extras.typeId), typeName(before.typeId)),
    line("specialization", t("admin.specialization"), specName, topic.specialization?.name ?? ""),
    line("level", t("admin.level"), chosenLevel, levelName(topic.specialization?.level, t)),
    line("year", t("admin.academicYear"), yearName, topic.academicYear?.title ?? ""),
    line("maxStudents", t("admin.maxStudents"), String(maxStudents), String(topic.maxStudents ?? "")),
    line("maxRequests", t("admin.maxRequests"), cap(capPayload(maxRequests)), cap(topic.maxRequests)),
  ];
  const seededIds = new Set(seededMembers.map((m) => m.id));
  const reviewStudents = picked.map((p) => ({ id: p.id, name: p.name, reg: p.reg, leader: p.id === leaderId, added: !seededIds.has(p.id) }));

  function submit() {
    setError(null);
    if (!canSubmit) return;
    updateTopic.mutate(
      {
        id: topicId,
        data: {
          title: title.trim(),
          description: description.trim(),
          maxStudents,
          maxRequests: capPayload(maxRequests),
          professorId,
          specializationId,
          academicYearId,
          requirements,
          objectives,
          // The topic alone: no team sent, so none touched.
          ...(mode === "topic" ? {} : { memberStudentIds: picked.map((p) => p.id), leaderStudentId: leaderId }),
          ...extrasPayload(extras, true),
        },
      },
      {
        onSuccess: () => {
          onClose();
          onUpdated?.();
        },
        onError: (e: any) =>
          setError(
            e?.response?.data?.message ??
              e?.message ??
              t("admin.assignCreateError"),
          ),
      },
    );
  }

  return (
    <>
      {/* شريط الخطوات المشترك — كما في حوار الإنشاء تماماً. */}
      <div className="shrink-0 border-b border-forest/10 bg-cream px-6 py-4">
        <Stepper
          steps={steps.map((key) => ({
            key,
            label: t(key === "topic" ? "admin.stepTopicTitle" : key === "students" ? "admin.stepStudentsTitle" : "admin.stepReview"),
          }))}
          current={stepIdx}
          onGo={(i) => setStepIdx(i)}
          ariaLabel={t(mode === "topic" ? "admin.editTopicOnlyTitle" : "admin.editAssignedTopicTitle")}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-7">
        {/* ══════════ STEP 1 ══════════ */}
        {stepKey === "topic" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr]">
            <section className="space-y-5">
              <SectionHead
                title={t("admin.sectionContent")}
                hint={t("admin.descriptionHint")}
              />

              <Field label={t("admin.topicTitle")}>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputCls}
                  placeholder={t("admin.assignTopicTitlePlaceholder")}
                />
              </Field>

              <Field label={t("admin.topicDescription")}>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={7}
                  className={`${inputCls} resize-y`}
                  placeholder={t("admin.assignTopicDescPlaceholder")}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t("admin.requirements")}
                  note={t("admin.optional")}
                  hint={t("admin.requirementsHint")}
                  group
                >
                  <ListInput
                    value={requirements}
                    onChange={setRequirements}
                    placeholder={t("admin.requirementItemPlaceholder")}
                  />
                </Field>
                <Field
                  label={t("admin.objectives")}
                  note={t("admin.optional")}
                  hint={t("admin.objectivesHint")}
                  group
                >
                  <ListInput
                    value={objectives}
                    onChange={setObjectives}
                    placeholder={t("admin.objectiveItemPlaceholder")}
                  />
                </Field>
              </div>

              {/* ── its type, its co-supervisor, its short description ── */}
              <SectionHead title={t("topicExtras.section")} hint={t("topicExtras.sectionHint")} />
              <TopicExtrasFields
                value={extras}
                onChange={setExtras}
                specializationId={specializationId || undefined}
                supervisorId={professorId || undefined}
              />
            </section>

            <section className="space-y-4 rounded-2xl border border-forest/10 bg-cream p-5">
              <SectionHead
                title={t("admin.sectionPlacement")}
                hint={t("admin.sectionPlacementHint")}
              />

              <Field label={t("admin.supervisor")}>
                <ProfessorPicker value={professorId} onChange={setProfessorId} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("admin.academicYear")}>
                  <Select
                    value={academicYearId}
                    onChange={(v) => setAcademicYearId(v)}
                    options={[
                      { value: "", label: t("admin.selectYear") },
                      ...(years ?? []).map((y: any) => ({ value: y.id, label: y.title })),
                    ]}
                  />
                </Field>

                {/* Set by the administration for the level — shown, never typed. */}
                <Field label={t("admin.maxStudents")} group>
                  <TeamSizeRuled
                    rule={teamRule}
                    seats={maxStudents}
                    year={yearName}
                    level={chosenLevel}
                    admin
                    onChoose={(v) => {
                      setChosenMax(v);
                      // تقليص السعة يُلغي المقاعد الزائدة نصّاً وإصابةً.
                      setSeatText((prev) => prev.slice(0, v));
                      setSeatHit((prev) => prev.slice(0, v));
                    }}
                  />
                </Field>

                {/*
                  سقفُ المحاولات — لا سقفُ المتزامن: الفهرسُ الفريد لا يسمح
                  بأكثر من طلبٍ حيٍّ واحد أصلاً، وهذا يمنع إعادة الطلب بلا نهاية.
                */}
                <div className="col-span-2">
                  <Field
                    label={t("admin.maxRequests")}
                    note={t("admin.optional")}
                    hint={t("admin.maxRequestsHint")}
                  >
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={maxRequests}
                      onChange={(e) => setMaxRequests(readCap(e.target.value))}
                      placeholder={t("admin.maxRequestsNone")}
                      className={inputCls}
                      dir="ltr"
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3 border-t border-forest/10 pt-4">
                <Field label={t("admin.faculty")}>
                  <Select
                    value={facultyId}
                    onChange={(v) => {
                      setFacultyId(v);
                      setDepartmentId("");
                      setFiliereId("");
                    }}
                    options={[
                      { value: "", label: t("admin.allFaculties") },
                      ...(faculties ?? []).map((f: any) => ({ value: f.id, label: f.name })),
                    ]}
                  />
                </Field>

                <Field label={t("admin.department")}>
                  <Select
                    value={departmentId}
                    onChange={(v) => {
                      setDepartmentId(v);
                      setFiliereId("");
                    }}
                    options={[
                      { value: "", label: t("admin.allDepartments") },
                      ...deptOptions.map((d: any) => ({ value: d.id, label: d.name })),
                    ]}
                  />
                </Field>

                <Field label={t("admin.filiere")}>
                  <Select
                    value={filiereId}
                    onChange={(v) => setFiliereId(v)}
                    options={[
                      { value: "", label: t("admin.allFilieres") },
                      ...filiereOptions.map((f: any) => ({ value: f.id, label: f.name })),
                    ]}
                  />
                </Field>

                <Field label={t("admin.specialization")}>
                  <Select
                    value={specializationId}
                    onChange={(v) => setSpecializationId(v)}
                    options={[
                      { value: "", label: t("admin.selectSpecialization") },
                      ...specOptions.map((sp: any) => ({ value: sp.id, label: sp.name })),
                    ]}
                  />
                </Field>
                {/*
                  The level is the specialization's: shown, never chosen. A text in a
                  field's frame, not a field — and not in a <label>, which would hand a
                  click to it — so nothing takes the focus: no ring, no caret.
                */}
                <Field label={t("admin.level")} note={t("admin.levelAuto")} group>
                  <div
                    data-testid="topic-level"
                    className={`w-full cursor-default rounded-xl border border-forest/15 bg-forest/5 px-3.5 py-2.5 text-sm select-none ${chosenLevel ? "font-semibold text-forest" : "text-clay"}`}
                  >
                    {chosenLevel || t("admin.levelFromSpec")}
                  </div>
                </Field>
              </div>
            </section>
          </div>
        )}

        {/* ══════════ STEP 2 ══════════ */}
        {stepKey === "students" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
            {/* ── seats ── */}
            <div className="rounded-2xl border border-forest/10 bg-cream p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                  <UserPlus size={16} />
                  {t("admin.assignStudents")}
                </p>
                <span
                  dir="ltr"
                  className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums"
                >
                  {picked.length} / {maxStudents}
                </span>
              </div>

              <ul className="space-y-2.5">
                {Array.from({ length: maxStudents }).map((_, i) => {
                  const hit = seatHit[i] ?? null;
                  return (
                    <StudentSeat
                      key={i}
                      seat={i + 1}
                      index={i}
                      value={seatText[i] ?? ""}
                      onChange={setSeat}
                      onResolve={resolveSeat}
                      taken={seatText
                        .slice(0, maxStudents)
                        .map((x) => (x ?? "").trim())
                        .filter((x, j) => x !== "" && j !== i)}
                      specializationId={specializationId}
                      specializationName={specName}
                      initial={seededMembers[i] ?? null}
                      isLeader={!!hit && hit.id === leaderId}
                      onMakeLeader={() => hit && setLeaderPick(hit.id)}
                      disabled={updateTopic.isPending}
                    />
                  );
                })}
              </ul>

              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-clay">
                <SendHorizontal size={12} className="mt-0.5 shrink-0 text-gold" />
                {t("admin.leaderHint")}
              </p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-clay/80">
                {t("admin.seatsHint")} {t("admin.searchScopedToSpec")}
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-forest/10 bg-cream p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-forest">
                    {t("admin.reviewTopic")}
                  </p>
                  <button
                    type="button"
                    onClick={() => goTo("topic")}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-forest/70 transition hover:bg-forest/5 hover:text-forest"
                  >
                    {t("admin.editStep")}
                  </button>
                </div>

                <p className="mb-3 line-clamp-2 font-serif text-[15px] leading-snug font-bold text-forest">
                  {title.trim() || t("admin.notSet")}
                </p>

                <dl className="space-y-2 text-[12px]">
                  <ReviewRow
                    label={t("admin.supervisor")}
                    value={professorName || t("admin.notSet")}
                  />
                  <ReviewRow
                    label={t("admin.specialization")}
                    value={specName || t("admin.notSet")}
                  />
                  <ReviewRow
                    label={t("admin.academicYear")}
                    value={yearName || t("admin.notSet")}
                  />
                  <ReviewRow
                    label={t("admin.maxStudents")}
                    value={String(maxStudents)}
                  />
                </dl>
              </div>

              {/* The current status, not a promised one: this topic already
                  exists, and editing it does not change where it stands. */}
              <div className="rounded-2xl border border-forest/10 bg-cream p-4">
                <p className="mb-2.5 text-sm font-semibold text-forest">
                  {t("admin.currentStatus")}
                </p>
                <span
                  className={`inline-block rounded-full px-3 py-1 text-[12px] font-semibold ${statusChip(topic.status)}`}
                >
                  {t(`status.${topic.status}`, { defaultValue: topic.status })}
                </span>
                <p className="mt-2.5 text-[11px] leading-relaxed text-clay">
                  {t("admin.statusFixedNote")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ THE REVIEW ══════════ */}
        {stepKey === "review" && (
          <TopicReviewStep
            topic={topicLines}
            placement={placementLines}
            students={mode === "topic" ? undefined : reviewStudents}
            untouchedStudents={mode === "topic"}
            onEdit={goTo}
          />
        )}

        {error && (
          <p className="mt-5 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* ── footer ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-forest/10 bg-cream-card px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-medium text-clay transition hover:bg-forest/5"
        >
          {t("admin.cancel")}
        </button>

        <div className="flex items-center gap-2">
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={() => setStepIdx((i) => i - 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 px-4 py-2.5 text-sm font-medium text-forest transition hover:bg-forest/5"
            >
              <ChevronLeft size={16} className="ltr:rotate-180" />
              {t("admin.back")}
            </button>
          )}

          {stepKey !== "review" ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => i + 1)}
              disabled={!stepValid}
              title={!stepValid ? t("admin.completeStepFirst") : undefined}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("admin.next")}
              <ChevronLeft size={16} className="rtl:rotate-180" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateTopic.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {t("admin.confirmSave")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
