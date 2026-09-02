import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { X, Type, FileText, CalendarDays, Hash, Save, Milestone as MilestoneIcon } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useCreateMilestone, useUpdateMilestone } from "../hooks/Professor-hook";
import {
  createMilestoneSchema,
  type CreateMilestoneInput,
  type CreateMilestoneFormValues,
} from "../validation/professor.schema";
import type { Milestone } from "../../../types/professor.types";

interface Props {
  open: boolean;
  onClose: () => void;
  groupId: string;
  milestone?: Milestone | null;
}

const field =
  "w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 placeholder:text-clay/50";

// Convert ISO → value for <input type="datetime-local">
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MilestoneFormDialog({ open, onClose, groupId, milestone }: Props) {
  const { t } = useTranslation();
  const { dir } = useLanguage();
  const editing = !!milestone;

  const create = useCreateMilestone();
  const update = useUpdateMilestone();
  const busy = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMilestoneFormValues, unknown, CreateMilestoneInput>({
    resolver: zodResolver(createMilestoneSchema),
    defaultValues: { title: "", description: "", deadline: "", order: 1 },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      milestone
        ? {
            title: milestone.title,
            description: milestone.description ?? "",
            deadline: toLocalInput(milestone.deadline),
            order: milestone.order,
          }
        : { title: "", description: "", deadline: "", order: 1 },
    );
  }, [open, milestone, reset]);

  function onSubmit(values: CreateMilestoneInput) {
    // datetime-local has no timezone; convert to ISO before sending.
    const payload = {
      ...values,
      deadline: values.deadline ? new Date(values.deadline).toISOString() : values.deadline,
    };
    if (editing && milestone) {
      update.mutate({ id: milestone.id, data: payload }, { onSuccess: onClose });
    } else {
      create.mutate({ groupId, data: payload }, { onSuccess: onClose });
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-forest-deep/50 backdrop-blur-sm" />
      <div dir={dir} onMouseDown={(e) => e.stopPropagation()} className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-cream-card shadow-2xl">
        {/* Header */}
        <div className="relative bg-forest px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-cream/15 text-cream">
                <MilestoneIcon size={20} />
              </div>
              <div>
                <h2 className="font-serif text-lg font-bold text-cream">
                  {editing ? t("pro.editMilestone") : t("pro.addMilestone")}
                </h2>
                <p className="text-xs text-cream/70">{t("pro.milestoneDialogSubtitle")}</p>
              </div>
            </div>
            <button onClick={onClose} className="grid size-8 place-items-center rounded-full text-cream/80 transition hover:bg-cream/15 hover:text-cream">
              <X size={18} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </div>

        {/* Body */}
        <form id="milestone-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
          <Field label={t("pro.title")} icon={Type} error={errors.title?.message}>
            <input {...register("title")} className={field} placeholder={t("pro.milestoneTitlePlaceholder")} />
          </Field>

          <Field label={t("pro.description")} icon={FileText} error={errors.description?.message}>
            <textarea {...register("description")} className={`${field} min-h-20 resize-y`} placeholder={t("pro.optional")} />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t("pro.deadline")} icon={CalendarDays} error={errors.deadline?.message}>
              <input type="datetime-local" {...register("deadline")} className={field} />
            </Field>
            <Field label={t("pro.order")} icon={Hash} error={errors.order?.message}>
              <input type="number" min={1} {...register("order")} className={field} />
            </Field>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-forest/10 bg-cream-2 px-6 py-4">
          <button type="submit" form="milestone-form" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60">
            <Save size={16} />
            {busy ? t("pro.saving") : t("pro.save")}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5">
            {t("pro.cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label, icon: Icon, error, children,
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