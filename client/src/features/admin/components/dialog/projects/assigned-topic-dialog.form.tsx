import { useCallback, useEffect, useMemo, useState } from "react";
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
  useCreateAssignedTopic,
  useProfessors,
  useFaculties,
  useDepartments,
  useFilieres,
  useSpecializations,
  useAcademicYears,
} from "../../../hooks/admin-hook";
import { statusChip } from "../../../utils/status-styles";
import { ProfessorPicker } from "../../ui/professor-picker";
import { ListInput } from "../../../../../components/ui/list-input";
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

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Creating an assigned topic asks for two unrelated things at once: what the
 * topic *is*, and who it goes to. As one long scroll the second half was
 * always below the fold, so the group — the part that cannot be undone once
 * saved — was the part nobody could see while filling the form.
 *
 * It is now two steps: the topic, then the people. Step two shows what step
 * one produced, so the assignment is confirmed against the topic it belongs
 * to rather than from memory.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

function fullName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ");
}

export function AssignedTopicDialog({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const createTopic = useCreateAssignedTopic();

  const [step, setStep] = useState<1 | 2>(1);

  // ── step 1: the topic ──
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxStudents, setMaxStudents] = useState(1);
  const [maxRequests, setMaxRequests] = useState<CapValue>("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [professorId, setProfessorId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [specializationId, setSpecializationId] = useState("");

  // ── step 2: the people ──
  //
  // مقعدٌ لكل طالبٍ يسمح به الموضوع، لا صندوقَ بحثٍ يُضيف حتى يمتلئ:
  // `maxStudents` معروفٌ منذ الخطوة الأولى، فيُعرف عدد المقاعد قبل أن
  // تُملأ. و`seatText` نصُّ كل مقعد، و`seatHit` من استقرّ عليه.
  const [seatText, setSeatText] = useState<string[]>([]);
  const [seatHit, setSeatHit] = useState<(SeatStudent | null)[]>([]);
  const [leaderPick, setLeaderPick] = useState("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
      setTitle("");
      setDescription("");
      setMaxStudents(1);
      setRequirements([]);
      setObjectives([]);
      setProfessorId("");
      setAcademicYearId("");
      setFacultyId("");
      setDepartmentId("");
      setFiliereId("");
      setSpecializationId("");
      setSeatText([]);
      setSeatHit([]);
      setLeaderPick("");
      setError(null);
    }
  }, [open]);

  // ── lookups ──
  // The picker searches server-side, so this list is only used to resolve the
  // chosen supervisor's name for the review panel. 100 is the API's ceiling.
  const { data: profsData } = useProfessors({ limit: 100 });
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const { data: filieres } = useFilieres();
  const { data: specs } = useSpecializations();
  const { data: years } = useAcademicYears();

  // `?? []` would be a new array each render, re-running the memo below.
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

  const professorName = useMemo(() => {
    const p = professors.find((x: any) => x.id === professorId);
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
    () =>
      seatHit.slice(0, maxStudents).filter(Boolean) as SeatStudent[],
    [seatHit, maxStudents],
  );

  /**
   * المرسِل يُشتقّ ولا يُخزَّن وحده.
   *
   * لو حُفظ في حالةٍ مستقلّة لبقي معرَّفُ طالبٍ مُسِحَ مقعدُه مرسِلاً —
   * فيُرسَل `leaderStudentId` لا يقابله عضو. فالاختيار يُحفظ، والقيمة
   * الفعلية تُصحَّح بما في المقاعد الآن.
   */
  const leaderId = useMemo(
    () =>
      picked.some((x) => x.id === leaderPick)
        ? leaderPick
        : (picked[0]?.id ?? ""),
    [picked, leaderPick],
  );

  // Step one stands on its own, so the wizard can refuse to advance rather
  // than letting an incomplete topic reach the assignment screen.
  const step1Valid = Boolean(
    title.trim() &&
      description.trim() &&
      professorId &&
      specializationId &&
      academicYearId,
  );
  const canSubmit =
    step1Valid &&
    picked.length >= 1 &&
    picked.length <= maxStudents &&
    leaderId &&
    !createTopic.isPending;

  function submit() {
    setError(null);
    if (!canSubmit) return;
    createTopic.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        maxStudents,
        maxRequests: capPayload(maxRequests),
        requirements,
        objectives,
        professorId,
        specializationId,
        academicYearId,
        memberStudentIds: picked.map((p) => p.id),
        leaderStudentId: leaderId,
      },
      {
        onSuccess: () => {
          onClose();
          onCreated?.();
        },
        onError: (e: any) => {
          setError(
            e?.response?.data?.message ??
              e?.message ??
              t("admin.assignCreateError"),
          );
        },
      },
    );
  }

  if (!open) return null;

  return createPortal(
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
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between bg-forest px-6 py-4 text-cream">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cream/10">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold">
                {t("admin.assignTopicTitle")}
              </h2>
              <p className="text-xs text-cream/70">
                {t("admin.stepOf", { current: step, total: 2 })}
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

        {/*
          شريط الخطوات المشترك — نفسه في معالج الهيكل الأكاديمي وإنشاء
          الحساب وحذف الموضوع. وكان هنا شريطٌ خاصّ من لسانَين عريضين
          (`StepTab`): يرسم الشيء نفسه بشيفرةٍ أخرى، ويسمح بالقفز إلى
          الأمام متى صحّت الخطوة الأولى. والتقدّم الآن من «التالي» وحده —
          فهو الذي يعرف ما يشترطه الانتقال — والرجوع بالنقر على خطوةٍ مرّت.
        */}
        <div className="shrink-0 border-b border-forest/10 bg-cream px-6 py-4">
          <Stepper
            steps={[
              { key: "topic", label: t("admin.stepTopicTitle") },
              { key: "students", label: t("admin.stepStudentsTitle") },
            ]}
            current={step - 1}
            onGo={(i) => setStep((i + 1) as 1 | 2)}
            ariaLabel={t("admin.assignTopicTitle")}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-7">
          {/* ══════════ STEP 1 — the topic ══════════ */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr]">
              {/* ── what the topic says ── */}
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
                  >
                    <ListInput
                    value={objectives}
                    onChange={setObjectives}
                    placeholder={t("admin.objectiveItemPlaceholder")}
                  />
                  </Field>
                </div>
              </section>

              {/* ── where the topic sits ── */}
              <section className="space-y-4 rounded-2xl border border-forest/10 bg-cream p-5">
                <SectionHead
                  title={t("admin.sectionPlacement")}
                  hint={t("admin.sectionPlacementHint")}
                />

                <Field label={t("admin.supervisor")}>
                  <ProfessorPicker
                    value={professorId}
                    onChange={setProfessorId}
                  />
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

                  <Field label={t("admin.maxStudents")}>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxStudents}
                      onChange={(e) => {
                        const v = Math.max(
                          1,
                          Math.min(10, Number(e.target.value) || 1),
                        );
                        setMaxStudents(v);
                        // تقليص السعة يُلغي المقاعد الزائدة نصّاً وإصابةً،
                        // فلا يبقى طالبٌ مسنَدٌ في مقعدٍ لم يعد موجوداً.
                        setSeatText((prev) => prev.slice(0, v));
                        setSeatHit((prev) => prev.slice(0, v));
                      }}
                      className={inputCls}
                      dir="ltr"
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

                {/* Each level gets its own label: stacked, the four dropdowns
                    previously relied on placeholder text alone to say which
                    was which. */}
                <div className="space-y-3 border-t border-forest/10 pt-4">
                  <Field label={t("admin.faculty")}>
                    <Select
                      value={facultyId}
                      onChange={(v) => {
                        setFacultyId(v);
                        setDepartmentId("");
                        setFiliereId("");
                        setSpecializationId("");
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
                        setSpecializationId("");
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
                      onChange={(v) => {
                        setFiliereId(v);
                        setSpecializationId("");
                      }}
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
                </div>
              </section>
            </div>
          )}

          {/* ══════════ STEP 2 — students, assignment, status ══════════ */}
          {step === 2 && (
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
                        isLeader={!!hit && hit.id === leaderId}
                        onMakeLeader={() => hit && setLeaderPick(hit.id)}
                        disabled={createTopic.isPending}
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

              {/* ── confirmation column ── */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-forest/10 bg-cream p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-forest">
                      {t("admin.reviewTopic")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
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

                {/* resulting status — decided by the server, shown here so the
                    consequence of confirming is visible before confirming */}
                <div className="rounded-2xl border border-forest/10 bg-cream p-4">
                  <p className="mb-2.5 text-sm font-semibold text-forest">
                    {t("admin.resultingStatus")}
                  </p>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-[12px] font-semibold ${statusChip("full")}`}
                  >
                    {t("status.full")}
                  </span>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-clay">
                    {t("admin.statusFixedNote")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-forest/10 bg-cream-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-medium text-clay transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>

          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 px-4 py-2.5 text-sm font-medium text-forest transition hover:bg-forest/5"
              >
                <ChevronLeft size={16} className="ltr:rotate-180" />
                {t("admin.back")}
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                title={!step1Valid ? t("admin.completeStepFirst") : undefined}
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
                {createTopic.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {t("admin.assignCreateBtn")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}




