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
  SendHorizontal,
  ChevronLeft,
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
  useProfessorTopicQuota,
} from "../hooks/Professor-hook";
import { TopicQuotaLine } from "./topic-quota-line";
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
import { ruleOf, seatsFor } from "../../../lib/team-size";
import { TeamSizeRuled } from "../../../components/topic/team-size-ruled";
import { ListInput } from "../../../components/ui/list-input";
import { TeamSeats, type PickedStudent } from "./team-seats";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { Select } from "../../../components/ui/select";
import { personName } from "../../../lib/person-name";
import { TopicExtrasFields } from "../../../components/topic/topic-extras-fields";
import { EMPTY_EXTRAS, extrasOf, extrasPayload } from "../../../lib/topic-extras";
import { acceptsProposals, formatDay, windowState } from "../../../lib/proposal-window";
import { levelName } from "../../../lib/spec-level";

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
  const { t, i18n } = useTranslation();
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
  // The type, the co-supervisor and the short description (lib/topic-extras).
  const [extras, setExtras] = useState(EMPTY_EXTRAS);

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
  /** The chosen specialization's level — the topic's — shown beside it. */
  const chosenLevel = levelName(chosenSpec?.level, t);
  // The number of students the administration set for the year and this level, if any (lib/team-size).
  const teamRule = ruleOf(academicYears, academicYearId, chosenSpec?.level);
  const maxStudents = seatsFor(teamRule, Number(watch("maxStudents")) || 1);
  // The administration's limit of topics for the chosen year. A new topic counts, and so does a
  // rejected one sent again or one moved to that year; one edited in place was counted already.
  const quotaCounts = !topic || topic.status === "rejected" || academicYearId !== topic.academicYearId;
  const { data: quota } = useProfessorTopicQuota(academicYearId || undefined, open && !!academicYearId && quotaCounts);
  const quotaFull = quotaCounts && !!quota && quota.max !== null && quota.used >= quota.max;

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMembers([]);
    setLeader("");
    setExtras(topic ? extrasOf(topic) : EMPTY_EXTRAS);
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
      // `keepFieldsRef` — see MilestoneFormDialog: a plain reset under the
      // React Compiler can leave the fields unregistered, and typing is lost.
      { keepFieldsRef: true },
    );
  }, [open, topic, reset]);

  function onSubmit(values: CreateTopicInput) {
    // Strip empty rows and the helper-only placement fields.
    const clean = {
      ...values,
      maxStudents,
      requirements: (values.requirements ?? []).filter((r) => r.trim() !== ""),
      objectives: (values.objectives ?? []).filter((o) => o.trim() !== ""),
      // Keep only references that have both a title and a url.
      references: (values.references ?? []).filter(
        (r) => r.title.trim() !== "" && r.url.trim() !== "",
      ),
      // An edit clears with null; a new topic leaves the empty ones out.
      ...extrasPayload(extras, !!(editing && topic)),
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
    personName(user) ||
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
                  group
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
                  group
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
                    {refArray.fields.map((f, i) => {
                      // A row the schema refuses blocks sending — so it says
                      // why, where it is. Without this the button did nothing.
                      const rowErrors = errors.references?.[i];
                      return (
                        <div key={f.id} className="rounded-xl bg-cream-card p-2">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              {...register(`references.${i}.title` as const)}
                              aria-invalid={!!rowErrors?.title}
                              className={`${inputCls} sm:flex-1`}
                              placeholder={t("pro.referenceTitlePlaceholder")}
                            />
                            <input
                              {...register(`references.${i}.url` as const)}
                              aria-invalid={!!rowErrors?.url}
                              dir="ltr"
                              className={`${inputCls} sm:flex-1`}
                              placeholder="https://…"
                            />
                            <button
                              type="button"
                              onClick={() => refArray.remove(i)}
                              aria-label={t("pro.delete")}
                              title={t("pro.delete")}
                              className="grid size-9 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-brick/10 hover:text-brick"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                          {(rowErrors?.title || rowErrors?.url) && (
                            <p className="mt-1.5 px-1 text-[11px] text-brick">
                              {[rowErrors.title?.message, rowErrors.url?.message].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── its type, its co-supervisor, its short description ── */}
              <SectionHead title={t("topicExtras.section")} hint={t("topicExtras.sectionHint")} />
              <TopicExtrasFields value={extras} onChange={setExtras} specializationId={specializationId || undefined} />
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
                          // A new topic goes only to a year taking proposals now;
                          // an edit keeps every year (editing stays open).
                          ...(academicYears ?? [])
                            .filter((y) => editing || acceptsProposals(y))
                            .map((y) => ({
                              value: y.id,
                              label: `${y.title}${y.isActive ? " ●" : ""}`,
                              hint:
                                !editing && windowState(y) === "open"
                                  ? t("pro.proposals.openUntil", { date: formatDay(y.proposalsCloseAt!, i18n.language) })
                                  : undefined,
                            })),
                        ]}
                      />
                    )}
                  />
                </Field>

                {/* Set by the administration for the level — shown, never typed. */}
                <Field label={t("pro.maxStudents")} group>
                  <TeamSizeRuled
                    rule={teamRule}
                    seats={maxStudents}
                    year={academicYears?.find((y) => y.id === academicYearId)?.title}
                    level={chosenLevel}
                    onChoose={(v) => setValue("maxStudents", v, { shouldDirty: true })}
                  />
                </Field>

                {quotaCounts && quota && <TopicQuotaLine quota={quota} className="col-span-2" />}
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

                {/* A numbered seat per student the topic allows — as the administration's. */}
                <TeamSeats
                  value={members}
                  max={maxStudents}
                  leader={leader}
                  onLeader={setLeader}
                  specializationId={specializationId || undefined}
                  specializationName={chosenSpec?.name}
                  onChange={(v) => {
                    setMembers(v);
                    const numbers = v.map((m) => m.registrationNumber);
                    // The first one added sends; a sender removed hands it to the first left.
                    if (leader && !numbers.includes(leader))
                      setLeader(numbers[0] ?? "");
                    else if (!leader && numbers.length > 0)
                      setLeader(numbers[0]);
                  }}
                />

                {/* As the administration's seats say it: who sends, and who is taken. */}
                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-clay">
                  <SendHorizontal size={12} className="mt-0.5 shrink-0 text-gold" />
                  {t("pro.leaderHint")}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-clay/80" data-testid="team-seats-hint">
                  {t("pro.registrationNumbersHint")} {t("pro.numbersCheckedOnSubmit")}
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
                disabled={!step1Valid || quotaFull}
                title={quotaFull ? t("pro.quota.fullButton") : !step1Valid ? t("pro.completeStepFirst") : undefined}
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pro.next")}
                <ChevronLeft size={16} className="rtl:rotate-180" />
              </button>
            ) : (
              <button
                type="submit"
                form="topic-form"
                disabled={busy || (withGroup && !teamValid) || quotaFull}
                title={quotaFull ? t("pro.quota.fullButton") : undefined}
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
