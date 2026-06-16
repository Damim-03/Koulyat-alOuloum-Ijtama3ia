import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  X,
  Type,
  FileText,
  Users2,
  Layers,
  CalendarDays,
  ListChecks,
  Target,
  Link2,
  Plus,
  Trash2,
  Save,
  Info,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import {
  useCreateTopic,
  useUpdateTopic,
  useSpecializations,
  useAcademicYears,
} from "../hooks/Professor-hook";
import {
  createTopicSchema,
  type CreateTopicInput,
} from "../validation/professor.schema";
import type { Topic } from "../../../types/professor.types";

interface Props {
  open: boolean;
  onClose: () => void;
  topic?: Topic | null; // set → edit mode
}

const field =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 placeholder:text-clay/50";

export function TopicFormDialog({ open, onClose, topic }: Props) {
  const { t } = useTranslation();
  const { dir } = useLanguage();
  const editing = !!topic;

  const { data: specializations } = useSpecializations();
  const { data: academicYears } = useAcademicYears();
  const create = useCreateTopic();
  const update = useUpdateTopic();
  const busy = create.isPending || update.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTopicInput>({
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

  const reqArray = useFieldArray({ control, name: "requirements" as never });
  const objArray = useFieldArray({ control, name: "objectives" as never });
  const refArray = useFieldArray({ control, name: "references" as never });

  useEffect(() => {
    if (!open) return;
    if (topic) {
      reset({
        title: topic.title,
        description: topic.description,
        maxStudents: topic.maxStudents,
        specializationId: topic.specializationId ?? "",
        academicYearId: topic.academicYearId ?? "",
        requirements: topic.requirements ?? [],
        objectives: topic.objectives ?? [],
        references: topic.references ?? [],
      });
    } else {
      reset({
        title: "",
        description: "",
        maxStudents: 1,
        specializationId: "",
        academicYearId: "",
        requirements: [],
        objectives: [],
        references: [],
      });
    }
  }, [open, topic, reset]);

  function onSubmit(values: CreateTopicInput) {
    // Strip empty rows from the repeatable lists.
    const clean = {
      ...values,
      requirements: (values.requirements ?? []).filter((r) => r.trim() !== ""),
      objectives: (values.objectives ?? []).filter((o) => o.trim() !== ""),
      // Keep only references that have both a title and a url.
      references: (values.references ?? []).filter(
        (r) => r.title.trim() !== "" && r.url.trim() !== "",
      ),
    };
    if (editing && topic) {
      update.mutate({ id: topic.id, data: clean }, { onSuccess: onClose });
    } else {
      create.mutate(clean, { onSuccess: onClose });
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-forest-deep/50 backdrop-blur-sm" />
      <div
        dir={dir}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-cream-card shadow-2xl"
      >
        {/* Header */}
        <div className="relative bg-forest px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-cream/15 text-cream">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-cream">
                  {editing ? t("pro.editTopic") : t("pro.newTopic")}
                </h2>
                <p className="text-xs text-cream/70">
                  {t("pro.topicDialogSubtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-cream/80 transition hover:bg-cream/15 hover:text-cream"
            >
              <X size={18} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </div>

        {/* Body (scrollable) */}
        <form
          id="topic-form"
          onSubmit={handleSubmit(onSubmit)}
          className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5"
        >
          {/* Title */}
          <Field
            label={t("pro.title")}
            icon={Type}
            error={errors.title?.message}
          >
            <input
              {...register("title")}
              className={field}
              placeholder={t("pro.titlePlaceholder")}
            />
          </Field>

          {/* Description */}
          <Field
            label={t("pro.description")}
            icon={FileText}
            error={errors.description?.message}
          >
            <textarea
              {...register("description")}
              className={`${field} min-h-24 resize-y`}
              placeholder={t("pro.descriptionPlaceholder")}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Max students */}
            <Field
              label={t("pro.maxStudents")}
              icon={Users2}
              error={errors.maxStudents?.message}
            >
              <input
                type="number"
                min={1}
                max={10}
                {...register("maxStudents")}
                className={field}
              />
            </Field>

            {/* Specialization */}
            <Field
              label={t("pro.specialization")}
              icon={Layers}
              error={errors.specializationId?.message}
            >
              <select {...register("specializationId")} className={field}>
                <option value="">{t("pro.selectSpecialization")}</option>
                {specializations?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* Academic year */}
            <Field
              label={t("pro.academicYear")}
              icon={CalendarDays}
              error={errors.academicYearId?.message}
            >
              <select {...register("academicYearId")} className={field}>
                <option value="">{t("pro.selectYear")}</option>
                {academicYears?.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.title}
                    {y.isActive ? " ●" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Requirements builder */}
          <ListBuilder
            label={t("pro.requirements")}
            icon={ListChecks}
            addLabel={t("pro.addRequirement")}
            fields={reqArray.fields}
            register={register}
            name="requirements"
            onAdd={() => reqArray.append("" as never)}
            onRemove={(i) => reqArray.remove(i)}
            field={field}
          />

          {/* Objectives builder */}
          <ListBuilder
            label={t("pro.objectives")}
            icon={Target}
            addLabel={t("pro.addObjective")}
            fields={objArray.fields}
            register={register}
            name="objectives"
            onAdd={() => objArray.append("" as never)}
            onRemove={(i) => objArray.remove(i)}
            field={field}
          />

          {/* References builder (title + url) — helps students */}
          <div className="rounded-xl bg-cream-2 p-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-forest">
                <Link2 size={14} className="text-clay" />
                {t("pro.references")}
              </label>
              <button
                type="button"
                onClick={() => refArray.append({ title: "", url: "" } as never)}
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
                    className="flex flex-col gap-2 rounded-lg bg-cream-card p-2 sm:flex-row sm:items-start"
                  >
                    <div className="flex-1">
                      <input
                        {...register(`references.${i}.title` as const)}
                        className={field}
                        placeholder={t("pro.referenceTitlePlaceholder")}
                      />
                      {errors.references?.[i]?.title && (
                        <p className="mt-1 text-[11px] text-red-500">
                          {errors.references[i]?.title?.message}
                        </p>
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        {...register(`references.${i}.url` as const)}
                        dir="ltr"
                        className={field}
                        placeholder="https://..."
                      />
                      {errors.references?.[i]?.url && (
                        <p className="mt-1 text-[11px] text-red-500">
                          {errors.references[i]?.url?.message}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => refArray.remove(i)}
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send-to-admin note */}
          <div className="flex items-start gap-2 rounded-xl bg-cream-2 px-4 py-3">
            <Info size={16} className="mt-0.5 shrink-0 text-gold" />
            <p className="text-[11px] leading-relaxed text-clay">
              {t("pro.sendToAdminNote")}
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-forest/10 bg-cream-2 px-6 py-4">
          <button
            type="submit"
            form="topic-form"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {busy
              ? t("pro.saving")
              : editing
                ? t("pro.save")
                : t("pro.sendToAdmin")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("pro.cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ListBuilder({
  label,
  icon: Icon,
  addLabel,
  fields,
  register,
  name,
  onAdd,
  onRemove,
  field,
}: {
  label: string;
  icon: typeof ListChecks;
  addLabel: string;
  fields: { id: string }[];
  register: any;
  name: "requirements" | "objectives";
  onAdd: () => void;
  onRemove: (i: number) => void;
  field: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium text-forest">
          <Icon size={14} className="text-clay" />
          {label}
        </label>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg bg-forest/10 px-2.5 py-1 text-[11px] font-semibold text-forest transition hover:bg-forest/15"
        >
          <Plus size={12} />
          {addLabel}
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="rounded-lg bg-cream-2 px-3 py-2 text-[11px] text-clay">
          {"\u2014"}
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              <input {...register(`${name}.${i}` as const)} className={field} />
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  icon?: typeof Type;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-forest">
        {Icon && <Icon size={14} className="text-clay" />}
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
