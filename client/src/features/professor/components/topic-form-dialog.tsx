import { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  X,
  FileText,
  FilePlus2,
  Users,
  UserPlus,
  Star,
  SendHorizontal,
  ChevronLeft,
  IdCard,
  Layers,
  Link2,
  Plus,
  Trash2,
  Save,
  Loader2,
  UserCog,
  Send,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useAuth } from "../../../hooks/use-auth";
import {
  useCreateTopic,
  useCreateTopicWithGroup,
  useUpdateTopic,
  useSpecializations,
  useAcademicYears,
  useFaculties,
  useDepartments,
} from "../hooks/Professor-hook";
import {
  createTopicSchema,
  type CreateTopicInput,
  type CreateTopicFormValues,
} from "../validation/professor.schema";
import { useState } from "react";
import type { Topic } from "../../../types/professor.types";
import {
  inputCls,
  SectionHead,
  Field,
} from "../../../components/ui/form-bits";
import { Stepper } from "../../../components/ui/stepper";
import { ListInput } from "../../../components/ui/list-input";
import { StudentPicker, type PickedStudent } from "./student-picker";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { Select } from "../../../components/ui/select";

/**
 * Proposing a topic, in the same room the administration proposes one in.
 *
 * The professor's dialog was a single narrow column that scrolled: what the
 * topic *is* and where it *sits* were the same list of fields, one after the
 * other. This is the two-panel layout the admin dialogs settled on — content
 * on one side, placement on the other — so both sides of the university are
 * filling in the same form.
 *
 * The API is untouched: the same fields go to POST /professor/topics.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  topic?: Topic | null; // set → edit mode
  /** Also propose the team for it — adds a second step. */
  withGroup?: boolean;
}

export function TopicFormDialog({
  open,
  onClose,
  topic,
  withGroup = false,
}: Props) {
  const { t } = useTranslation();
  const { dir } = useLanguage();
  const { user } = useAuth();
  const editing = !!topic;

  const { data: specializations } = useSpecializations();
  const { data: academicYears } = useAcademicYears();
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments();
  const create = useCreateTopic();
  const createWithGroup = useCreateTopicWithGroup();
  const update = useUpdateTopic();
  const busy =
    create.isPending || createWithGroup.isPending || update.isPending;

  // ── step two: the proposed team ──
  // Registration numbers, not ids: a professor has no endpoint that lists
  // students, and the backend resolves the numbers exactly as it does for a
  // student's own group request.
  const [step, setStep] = useState<1 | 2>(1);
  const [members, setMembers] = useState<PickedStudent[]>([]);
  const [leader, setLeader] = useState("");

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTopicFormValues, unknown, CreateTopicInput>({
    resolver: zodResolver(createTopicSchema),
    defaultValues: {
      title: "",
      description: "",
      maxStudents: 1,
      specializationId: "",
      academicYearId: "",
      requirements: [],
      objectives: [],
      references: [],
    },
  });

  const refArray = useFieldArray({ control, name: "references" as never });

  // eslint-disable-next-line react-hooks/incompatible-library
  const title = watch("title") ?? "";
  const description = watch("description") ?? "";
  const requirements = watch("requirements") ?? [];
  const objectives = watch("objectives") ?? [];
  const specializationId = watch("specializationId");
  const academicYearId = watch("academicYearId");
  const maxStudents = Number(watch("maxStudents")) || 1;

  // ── the placement cascade ──
  // Only `specializationId` is persisted; faculty, department and filiere
  // are here to narrow a long list down to the right one. They are derived
  // from the specialization rows themselves, which carry the whole chain.
  const chosenSpec = useMemo(
    () => (specializations ?? []).find((s) => s.id === specializationId),
    [specializations, specializationId],
  );
  const [facultyId, departmentId, filiereId] = [
    watch("facultyId"),
    watch("departmentId"),
    watch("filiereId"),
  ];

  const deptOptions = useMemo(
    () =>
      (departments ?? []).filter((d) => !facultyId || d.facultyId === facultyId),
    [departments, facultyId],
  );
  const filiereOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of specializations ?? []) {
      if (!s.filiere) continue;
      if (departmentId && s.departmentId !== departmentId) continue;
      if (facultyId && !departmentId) {
        const d = (departments ?? []).find((dd) => dd.id === s.departmentId);
        if (d && d.facultyId !== facultyId) continue;
      }
      seen.set(s.filiere.id, s.filiere.name);
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [specializations, departmentId, facultyId, departments]);
  const specOptions = useMemo(
    () =>
      (specializations ?? []).filter((s) => {
        if (filiereId && s.filiereId !== filiereId) return false;
        if (departmentId && !filiereId && s.departmentId !== departmentId)
          return false;
        if (facultyId && !departmentId && !filiereId) {
          const d = (departments ?? []).find((dd) => dd.id === s.departmentId);
          if (d && d.facultyId !== facultyId) return false;
        }
        return true;
      }),
    [specializations, filiereId, departmentId, facultyId, departments],
  );

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMembers([]);
    setLeader("");
    reset(
      topic
        ? {
            title: topic.title,
            description: topic.description,
            maxStudents: topic.maxStudents,
            specializationId: topic.specializationId ?? "",
            academicYearId: topic.academicYearId ?? "",
            requirements: topic.requirements ?? [],
            objectives: topic.objectives ?? [],
            references: topic.references ?? [],
          }
        : {
            title: "",
            description: "",
            maxStudents: 1,
            specializationId: "",
            academicYearId: "",
            requirements: [],
            objectives: [],
            references: [],
          },
    );
  }, [open, topic, reset]);

  function onSubmit(values: CreateTopicInput) {
    // Strip empty rows and the helper-only placement fields.
    const clean = {
      ...values,
      requirements: (values.requirements ?? []).filter((r) => r.trim() !== ""),
      objectives: (values.objectives ?? []).filter((o) => o.trim() !== ""),
      // Keep only references that have both a title and a url.
      references: (values.references ?? []).filter(
        (r) => r.title.trim() !== "" && r.url.trim() !== "",
      ),
    };
    delete (clean as Record<string, unknown>).facultyId;
    delete (clean as Record<string, unknown>).departmentId;
    delete (clean as Record<string, unknown>).filiereId;

    if (editing && topic) {
      update.mutate({ id: topic.id, data: clean }, { onSuccess: onClose });
    } else if (withGroup) {
      createWithGroup.mutate(
        {
          ...clean,
          memberRegistrationNumbers: members.map((m) => m.registrationNumber),
          leaderRegistrationNumber: leader,
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(clean, { onSuccess: onClose });
    }
  }

  // Step one has to stand on its own before the team screen is reachable.
  const step1Valid = Boolean(
    title.trim() && description.trim() && specializationId && academicYearId,
  );
  const teamValid =
    members.length > 0 && members.length <= maxStudents && !!leader;

  if (!open) return null;

  const professorName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.universityEmail ||
    "—";

  return createPortal(
    <div
      className="fixed inset-0 z-100 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-forest-deep/50 backdrop-blur-sm"
      />

      <div
        dir={dir}
        className="animate-[fadeIn_0.15s_ease-out] relative flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-cream-card shadow-[0_20px_60px_rgba(38,66,61,0.25)]"
      >
        {/* ── header ── */}
        <header className="relative flex shrink-0 items-center justify-between bg-forest px-6 py-4 text-cream">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cream/10">
              {editing ? <FileText size={20} /> : <FilePlus2 size={20} />}
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold">
                {editing ? t("pro.editTopic") : t("pro.newTopic")}
              </h2>
              <p className="text-xs text-cream/70">
                {withGroup && !editing
                  ? t("pro.stepOf", { current: step, total: 2 })
                  : t("pro.topicDialogSubtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={() => !busy && onClose()}
            aria-label={t("pro.cancel")}
            className="grid size-8 place-items-center rounded-lg text-cream/80 transition hover:bg-cream/10"
          >
            <X size={18} />
          </button>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </header>

        {/* شريط الخطوات المشترك — كما في حوارَي الإدارة. */}
        {withGroup && (
          <div className="shrink-0 border-b border-forest/10 bg-cream px-6 py-4">
            <Stepper
              steps={[
                { key: "topic", label: t("pro.stepTopicTitle") },
                { key: "team", label: t("pro.stepTeamTitle") },
              ]}
              current={step - 1}
              onGo={(i) => setStep((i + 1) as 1 | 2)}
              ariaLabel={t("pro.newTopic")}
            />
          </div>
        )}

        {/* ── body: content beside placement ── */}
        <form
          id="topic-form"
          onSubmit={handleSubmit(onSubmit)}
          className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-7"
        >
          <div
            className="grid grid-cols-1 gap-6 lg:grid-cols-[1.55fr_1fr]"
            hidden={withGroup && step === 2}
          >
            {/* ══ what the topic says ══ */}
            <section className="space-y-5">
              <SectionHead
                title={t("pro.topicContent")}
                hint={t("pro.topicContentHint")}
              />

              <Field label={t("pro.title")} error={errors.title?.message}>
                <input
                  autoFocus
                  {...register("title")}
                  className={inputCls}
                  placeholder={t("pro.titlePlaceholder")}
                />
              </Field>

              <Field
                label={t("pro.description")}
                error={errors.description?.message}
              >
                <textarea
                  {...register("description")}
                  rows={7}
                  className={`${inputCls} resize-y`}
                  placeholder={t("pro.descriptionPlaceholder")}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t("pro.requirements")}
                  note={t("pro.optional")}
                  hint={t("pro.requirementsHint")}
                >
                  <ListInput
                    value={requirements}
                    onChange={(v) =>
                      setValue("requirements", v, { shouldDirty: true })
                    }
                    placeholder={t("pro.requirementItemPlaceholder")}
                  />
                </Field>
                <Field
                  label={t("pro.objectives")}
                  note={t("pro.optional")}
                  hint={t("pro.objectivesHint")}
                >
                  <ListInput
                    value={objectives}
                    onChange={(v) =>
                      setValue("objectives", v, { shouldDirty: true })
                    }
                    placeholder={t("pro.objectiveItemPlaceholder")}
                  />
                </Field>
              </div>

              {/* ── references: a title and a link, so they cannot be typed
                     as one chip like the two lists above ── */}
              <div className="rounded-2xl border border-forest/10 bg-cream p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-forest">
                    <Link2 size={14} className="text-clay" />
                    {t("pro.references")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      refArray.append({ title: "", url: "" } as never)
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-forest/10 px-2.5 py-1 text-[11px] font-semibold text-forest transition hover:bg-forest/15"
                  >
                    <Plus size={12} />
                    {t("pro.addReference")}
                  </button>
                </div>
                <p className="mb-2.5 text-[11px] text-clay">
                  {t("pro.referencesHint")}
                </p>

                {refArray.fields.length === 0 ? (
                  <p className="rounded-lg bg-cream-card px-3 py-2 text-[11px] text-clay">
                    {t("pro.noReferencesYet")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {refArray.fields.map((f, i) => (
                      <div
                        key={f.id}
                        className="flex flex-col gap-2 rounded-xl bg-cream-card p-2 sm:flex-row sm:items-center"
                      >
                        <input
                          {...register(`references.${i}.title` as const)}
                          className={`${inputCls} sm:flex-1`}
                          placeholder={t("pro.referenceTitlePlaceholder")}
                        />
                        <input
                          {...register(`references.${i}.url` as const)}
                          dir="ltr"
                          className={`${inputCls} sm:flex-1`}
                          placeholder="https://…"
                        />
                        <button
                          type="button"
                          onClick={() => refArray.remove(i)}
                          className="grid size-9 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-brick/10 hover:text-brick"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ══ where the topic sits ══ */}
            <section className="space-y-4 rounded-2xl border border-forest/10 bg-cream p-5">
              <SectionHead
                title={t("pro.placement")}
                hint={t("pro.placementHint")}
              />

              {/* The supervisor is not a choice here — it is whoever is
                  proposing. Shown, not asked. */}
              <Field label={t("pro.supervisor")}>
                <div className="flex items-center gap-2.5 rounded-xl border border-forest/15 bg-cream-2 px-3 py-2">
                  <UserAvatar user={user} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-forest">
                    {professorName}
                  </span>
                  <UserCog size={14} className="shrink-0 text-clay" />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t("pro.academicYear")}
                  error={errors.academicYearId?.message}
                >
                  <Controller
                    control={control}
                    name="academicYearId"
                    render={({ field }) => (
                      <Select
                        ref={field.ref}
                        value={(field.value as string) ?? ""}
                        onChange={(v) => {
                          field.onChange(v);
                        }}
                        options={[
                          { value: "", label: t("pro.selectYear") },
                          ...(academicYears ?? []).map((y) => ({
                            value: y.id,
                            label: `${y.title}${y.isActive ? " ●" : ""}`,
                          })),
                        ]}
                      />
                    )}
                  />
                </Field>

                <Field
                  label={t("pro.maxStudents")}
                  error={errors.maxStudents?.message}
                >
                  <input
                    type="number"
                    min={1}
                    max={10}
                    {...register("maxStudents")}
                    className={inputCls}
                    dir="ltr"
                  />
                </Field>
              </div>

              <div className="space-y-3 border-t border-forest/10 pt-4">
                <Field label={t("pro.faculty")}>
                  <Controller
                    control={control}
                    name="facultyId"
                    render={({ field }) => (
                      <Select
                        ref={field.ref}
                        value={(field.value as string) ?? ""}
                        onChange={(v) => {
                          field.onChange(v);
                        // ما كان مُرفقاً بـ`register` يبقى كما هو
                        setValue("departmentId", "");
                                                setValue("filiereId", "");
                                                setValue("specializationId", "");
                        }}
                        options={[
                          { value: "", label: t("pro.allFaculties") },
                          ...(faculties ?? []).map((f) => ({ value: f.id, label: f.name })),
                        ]}
                      />
                    )}
                  />
                </Field>

                <Field label={t("pro.department")}>
                  <Controller
                    control={control}
                    name="departmentId"
                    render={({ field }) => (
                      <Select
                        ref={field.ref}
                        value={(field.value as string) ?? ""}
                        onChange={(v) => {
                          field.onChange(v);
                        // ما كان مُرفقاً بـ`register` يبقى كما هو
                        setValue("filiereId", "");
                                                setValue("specializationId", "");
                        }}
                        options={[
                          { value: "", label: t("pro.allDepartments") },
                          ...deptOptions.map((d) => ({ value: d.id, label: d.name })),
                        ]}
                      />
                    )}
                  />
                </Field>

                <Field label={t("pro.filiere")}>
                  <Controller
                    control={control}
                    name="filiereId"
                    render={({ field }) => (
                      <Select
                        ref={field.ref}
                        value={(field.value as string) ?? ""}
                        onChange={(v) => {
                          field.onChange(v);
                          // ما كان مُرفقاً بـ`register` يبقى كما هو
                          setValue("specializationId", "");
                        }}
                        options={[
                          { value: "", label: t("pro.allFilieres") },
                          ...filiereOptions.map((f) => ({ value: f.id, label: f.name })),
                        ]}
                      />
                    )}
                  />
                </Field>

                <Field
                  label={t("pro.specialization")}
                  error={errors.specializationId?.message}
                >
                  <Controller
                    control={control}
                    name="specializationId"
                    render={({ field }) => (
                      <Select
                        ref={field.ref}
                        value={(field.value as string) ?? ""}
                        onChange={(v) => {
                          field.onChange(v);
                        }}
                        options={[
                          { value: "", label: t("pro.selectSpecialization") },
                          ...specOptions.map((s) => ({ value: s.id, label: s.name })),
                        ]}
                      />
                    )}
                  />
                </Field>
              </div>

              {/* the chain the selects resolve to, spelled out */}
              <div className="rounded-xl bg-cream-2/70 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[10px] font-bold text-clay">
                  <Layers size={11} />
                  {t("pro.academicPath")}
                </p>
                <p className="text-[11px] leading-relaxed text-forest">
                  {[
                    faculties?.find((f) => f.id === facultyId)?.name,
                    deptOptions.find((d) => d.id === departmentId)?.name,
                    filiereOptions.find((f) => f.id === filiereId)?.name ??
                      chosenSpec?.filiere?.name,
                    chosenSpec?.name,
                  ]
                    .filter(Boolean)
                    .join(" ← ") || "—"}
                </p>
              </div>
            </section>
          </div>

          {/* ══════════ STEP 2 — the proposed team ══════════ */}
          {withGroup && step === 2 && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
              <div className="rounded-2xl border border-forest/10 bg-cream p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                    <UserPlus size={16} />
                    {t("pro.proposedTeam")}
                  </p>
                  <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-bold text-forest tabular-nums">
                    {members.length} / {maxStudents}
                  </span>
                </div>

                <Field
                  label={t("pro.registrationNumbers")}
                  hint={t("pro.registrationNumbersHint")}
                >
                  <StudentPicker
                    value={members}
                    max={maxStudents}
                    specializationId={specializationId || undefined}
                    onChange={(v) => {
                      setMembers(v);
                      const numbers = v.map((m) => m.registrationNumber);
                      // A leader who was removed cannot stay the leader.
                      if (leader && !numbers.includes(leader))
                        setLeader(numbers[0] ?? "");
                      else if (!leader && numbers.length === 1)
                        setLeader(numbers[0]);
                    }}
                  />
                </Field>

                {members.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-medium text-clay">
                      {t("pro.pickLeader")}
                    </p>
                    {members.map((m) => {
                      const reg = m.registrationNumber;
                      const isLeader = leader === reg;
                      return (
                        <button
                          key={reg}
                          type="button"
                          onClick={() => setLeader(reg)}
                          className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-start transition ${
                            isLeader
                              ? "border-gold bg-gold/5"
                              : "border-forest/10 bg-cream-card hover:border-gold/40"
                          }`}
                        >
                          <span
                            className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                              isLeader
                                ? "bg-gold/20 text-gold"
                                : "text-clay"
                            }`}
                          >
                            {isLeader ? (
                              <SendHorizontal size={15} />
                            ) : (
                              <Star size={15} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-forest">
                              {m.name}
                            </span>
                            <span
                              className="block truncate text-[11px] text-clay"
                              dir="ltr"
                            >
                              {reg}
                            </span>
                          </span>
                          {isLeader && (
                            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-bold text-gold">
                              {t("pro.leader")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-clay">
                  <IdCard size={12} className="mt-0.5 shrink-0 text-gold" />
                  {t("pro.numbersCheckedOnSubmit")}
                </p>
              </div>

              {/* what the administration will receive */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-forest/10 bg-cream p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-forest">
                      {t("pro.reviewTopic")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-forest/70 transition hover:bg-forest/5 hover:text-forest"
                    >
                      {t("pro.editStep")}
                    </button>
                  </div>
                  <p className="mb-3 line-clamp-2 font-serif text-[15px] leading-snug font-bold text-forest">
                    {title.trim() || t("pro.notSet")}
                  </p>
                  <dl className="space-y-2 text-[12px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-clay">{t("pro.specialization")}</dt>
                      <dd className="truncate font-medium text-forest">
                        {chosenSpec?.name ?? t("pro.notSet")}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-clay">{t("pro.academicYear")}</dt>
                      <dd className="truncate font-medium text-forest">
                        {academicYears?.find((y) => y.id === academicYearId)
                          ?.title ?? t("pro.notSet")}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-clay">{t("pro.maxStudents")}</dt>
                      <dd className="font-medium text-forest tabular-nums">
                        {maxStudents}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* the consequence of sending, said before sending */}
                <div className="rounded-2xl border border-forest/10 bg-cream p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-forest">
                    <Users size={15} />
                    {t("pro.whatHappensNext")}
                  </p>
                  <p className="text-[11px] leading-relaxed text-clay">
                    {t("pro.withGroupFlowNote")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* ── footer ── */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-forest/10 bg-cream-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-medium text-clay transition hover:bg-forest/5 disabled:opacity-60"
          >
            {t("pro.cancel")}
          </button>

          <div className="flex items-center gap-2">
            {withGroup && step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 px-4 py-2.5 text-sm font-medium text-forest transition hover:bg-forest/5"
              >
                <ChevronLeft size={16} className="ltr:rotate-180" />
                {t("pro.back")}
              </button>
            )}

            {withGroup && step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                title={!step1Valid ? t("pro.completeStepFirst") : undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pro.next")}
                <ChevronLeft size={16} className="rtl:rotate-180" />
              </button>
            ) : (
              <button
                type="submit"
                form="topic-form"
                disabled={busy || (withGroup && !teamValid)}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : editing ? (
                  <Save size={16} />
                ) : (
                  <Send size={16} />
                )}
                {editing ? t("pro.saveChanges") : t("pro.sendToAdmin")}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
