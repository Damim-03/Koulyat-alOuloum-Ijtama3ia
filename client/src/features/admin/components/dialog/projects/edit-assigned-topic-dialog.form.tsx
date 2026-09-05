import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  X,
  FileText,
  Save,
  Search,
  Star,
  UserPlus,
  SendHorizontal,
  Loader2,
  ChevronLeft,
  Users,
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
  useStudents,
} from "../../../hooks/admin-hook";
import { ProfessorPicker } from "../../ui/professor-picker";
import { ListInput } from "../../ui/list-input";
import { statusChip } from "../../../utils/status-styles";
import {
  inputCls,
  SectionHead,
  Field,
  StepTab,
  ReviewRow,
} from "../../ui/form-bits";
import { UserAvatar } from "../../../../../components/ui/user-avatar";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Edit an assigned topic.
 *
 * Rebuilt on the same two-step shape as the create dialog: they ask for the
 * same things, and having them look like two unrelated forms meant every
 * improvement had to be made twice — and in practice only ever was made once.
 * The shared pieces now live in ui/form-bits.
 *
 * Members are seeded from the topic endpoint, which returns the group roster,
 * so this no longer needs a second request for the project.
 */

const selectCls = inputCls;

interface Props {
  /** The topic being edited — the dialog is open when this is not null. */
  topicId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

interface PickedStudent {
  id: string;
  name: string;
  reg: string;
  user?: any;
}

function fullName(u: any) {
  return [u?.firstName, u?.lastName].filter(Boolean).join(" ");
}
export function EditAssignedTopicDialog({
  topicId,
  onClose,
  onUpdated,
}: Props) {
  const { data: topic, isLoading } = useAdminTopic(topicId ?? "");

  if (!topicId) return null;

  // The form mounts only once the topic has arrived, so its fields are seeded
  // by useState initialisers instead of effects that sync after the fact.
  return createPortal(
    <Shell onClose={onClose}>
      {isLoading || !topic ? (
        <div className="grid place-items-center py-20 text-clay">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <EditForm
          key={topicId}
          topicId={topicId}
          topic={topic as any}
          onClose={onClose}
          onUpdated={onUpdated}
        />
      )}
    </Shell>,
    document.body,
  );
}

function Shell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-forest-deep/40 p-4 backdrop-blur-sm"
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
                {t("admin.editAssignedTopicTitle")}
              </h2>
              <p className="text-xs text-cream/70">
                {t("admin.editAssignedTopicSubtitle")}
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
}: {
  topicId: string;
  topic: any;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const { t } = useTranslation();
  const updateTopic = useUpdateAssignedTopic();

  const [step, setStep] = useState<1 | 2>(1);

  const [title, setTitle] = useState<string>(() => topic.title ?? "");
  const [description, setDescription] = useState<string>(
    () => topic.description ?? "",
  );
  const [maxStudents, setMaxStudents] = useState<number>(
    () => topic.maxStudents ?? 1,
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

  // The cascade starts empty: every level then lists everything, so the
  // topic's existing specialization stays selectable without pre-walking
  // the hierarchy backwards.
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [filiereId, setFiliereId] = useState("");

  const [picked, setPicked] = useState<PickedStudent[]>(() =>
    ((topic.projectGroup?.members ?? []) as any[]).map((m) => ({
      id: m.student?.id,
      name: fullName(m.student?.user) || "—",
      reg: m.student?.registrationNumber ?? "",
      user: m.student?.user,
    })),
  );
  const [leaderId, setLeaderId] = useState<string>(
    () =>
      ((topic.projectGroup?.members ?? []) as any[]).find((m) => m.isLeader)
        ?.student?.id ?? "",
  );

  const [studentSearch, setStudentSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(studentSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [studentSearch]);

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

  const { data: studentsData, isFetching: searching } = useStudents(
    debounced
      ? {
          page: 1,
          limit: 8,
          quickSearch: debounced,
          specializationId: specializationId || undefined,
          unassigned: "true",
        }
      : undefined,
  );
  const searchResults = ((studentsData?.items ?? []) as any[]).filter(
    (s) => !picked.some((p) => p.id === s.id),
  );

  const professorName = useMemo(() => {
    const p = (professors as any[]).find((x) => x.id === professorId);
    return p ? fullName(p.user) || p.universityEmail : "";
  }, [professors, professorId]);
  const specName =
    (specs ?? []).find((s: any) => s.id === specializationId)?.name ?? "";
  const yearName =
    (years ?? []).find((y: any) => y.id === academicYearId)?.title ?? "";

  function addStudent(s: any) {
    if (picked.length >= maxStudents) {
      setError(t("admin.assignMaxReached", { count: maxStudents }));
      return;
    }
    setPicked((prev) => [
      ...prev,
      {
        id: s.id,
        name: fullName(s.user) || "—",
        reg: s.registrationNumber ?? "",
        user: s.user,
      },
    ]);
    setLeaderId((cur) => cur || s.id);
    setStudentSearch("");
    setError(null);
  }
  function removeStudent(id: string) {
    const next = picked.filter((p) => p.id !== id);
    setPicked(next);
    if (leaderId === id) setLeaderId(next[0]?.id ?? "");
  }

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
    !updateTopic.isPending;

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
          professorId,
          specializationId,
          academicYearId,
          requirements,
          objectives,
          memberStudentIds: picked.map((p) => p.id),
          leaderStudentId: leaderId,
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
      {/* ── stepper ── */}
      <div className="grid shrink-0 grid-cols-2 border-b border-forest/10 bg-cream">
        <StepTab
          n={1}
          active={step === 1}
          done={step > 1 && step1Valid}
          title={t("admin.stepTopicTitle")}
          hint={t("admin.stepTopicHint")}
          onClick={() => setStep(1)}
        />
        <StepTab
          n={2}
          active={step === 2}
          done={false}
          disabled={!step1Valid}
          title={t("admin.stepStudentsTitle")}
          hint={
            step1Valid
              ? t("admin.stepStudentsHint")
              : t("admin.completeStepFirst")
          }
          onClick={() => step1Valid && setStep(2)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-7">
        {/* ══════════ STEP 1 ══════════ */}
        {step === 1 && (
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
                  <select
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">{t("admin.selectYear")}</option>
                    {(years ?? []).map((y: any) => (
                      <option key={y.id} value={y.id}>
                        {y.title}
                      </option>
                    ))}
                  </select>
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
                      if (picked.length > v) setPicked(picked.slice(0, v));
                    }}
                    className={inputCls}
                    dir="ltr"
                  />
                </Field>
              </div>

              <div className="space-y-3 border-t border-forest/10 pt-4">
                <Field label={t("admin.faculty")}>
                  <select
                    value={facultyId}
                    onChange={(e) => {
                      setFacultyId(e.target.value);
                      setDepartmentId("");
                      setFiliereId("");
                    }}
                    className={selectCls}
                  >
                    <option value="">{t("admin.allFaculties")}</option>
                    {(faculties ?? []).map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("admin.department")}>
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      setFiliereId("");
                    }}
                    className={selectCls}
                  >
                    <option value="">{t("admin.allDepartments")}</option>
                    {deptOptions.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("admin.filiere")}>
                  <select
                    value={filiereId}
                    onChange={(e) => setFiliereId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">{t("admin.allFilieres")}</option>
                    {filiereOptions.map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label={t("admin.specialization")}>
                  <select
                    value={specializationId}
                    onChange={(e) => setSpecializationId(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">{t("admin.selectSpecialization")}</option>
                    {specOptions.map((sp: any) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>
          </div>
        )}

        {/* ══════════ STEP 2 ══════════ */}
        {step === 2 && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-forest/10 bg-cream p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                  <UserPlus size={16} />
                  {t("admin.assignStudents")}
                </p>
                <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums">
                  {picked.length} / {maxStudents}
                </span>
              </div>

              {picked.length === 0 && (
                <div className="mb-3 grid place-items-center rounded-xl border border-dashed border-forest/15 py-6 text-center">
                  <Users size={22} className="mb-1.5 text-clay/60" />
                  <p className="text-xs text-clay">
                    {t("admin.noStudentsPicked")}
                  </p>
                </div>
              )}

              {picked.length > 0 && (
                <div className="mb-3 space-y-2">
                  {picked.map((p) => {
                    const isLeader = leaderId === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                          isLeader
                            ? "border-gold bg-gold/5"
                            : "border-forest/10 bg-cream-card"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setLeaderId(p.id)}
                            title={t("admin.setLeader")}
                            className={`grid size-7 shrink-0 place-items-center rounded-lg transition ${
                              isLeader
                                ? "bg-gold/20 text-gold"
                                : "text-clay hover:bg-forest/5 hover:text-gold"
                            }`}
                          >
                            {isLeader ? (
                              <SendHorizontal size={15} />
                            ) : (
                              <Star size={15} />
                            )}
                          </button>
                          <UserAvatar user={p.user} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-forest">
                              {p.name}
                              {isLeader && (
                                <span className="ms-2 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                                  {t("admin.leader")}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-clay" dir="ltr">
                              {p.reg}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStudent(p.id)}
                          className="grid size-7 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-red-500/10 hover:text-red-500"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {picked.length < maxStudents && (
                <div className="relative">
                  <Search
                    className="absolute top-1/2 end-3 -translate-y-1/2 text-clay"
                    size={16}
                  />
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder={t("admin.searchStudentAny")}
                    className="w-full rounded-xl border border-forest/15 bg-cream-card py-2 pe-9 ps-3 text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
                  />
                  {debounced && (
                    <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-forest/10 bg-cream-card">
                      {searching && (
                        <p className="px-3 py-3 text-center text-xs text-clay">
                          {"…"}
                        </p>
                      )}
                      {!searching && searchResults.length === 0 && (
                        <p className="px-3 py-3 text-center text-xs text-clay">
                          {t("admin.noSearchResults")}
                        </p>
                      )}
                      {searchResults.map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => addStudent(s)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition hover:bg-forest/5"
                        >
                          <UserAvatar user={s.user} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-forest">
                              {fullName(s.user) || "—"}
                            </p>
                            <p className="text-[11px] text-clay" dir="ltr">
                              {s.registrationNumber}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-clay">
                <SendHorizontal size={12} className="mt-0.5 shrink-0 text-gold" />
                {t("admin.leaderHint")}
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
              {t("admin.saveChanges")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
