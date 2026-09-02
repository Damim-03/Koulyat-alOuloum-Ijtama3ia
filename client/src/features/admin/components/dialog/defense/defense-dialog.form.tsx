import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { CalendarClock, FolderKanban, MapPin, Award, Save } from "lucide-react";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { useCreateDefense, useAdminProjects } from "../../../hooks/admin-hook";
import {
  type CreateDefenseInput,
  type CreateDefenseFormValues,
  createDefenseSchema,
} from "../../../validation/admin.schema";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Strip empty strings → undefined before sending to the backend. */
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== "" && v !== undefined && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}

export function DefenseFormDialog({ open, onClose }: Props) {
  const { t } = useTranslation();

  const createDefense = useCreateDefense();
  // Projects supply the group (ProjectGroup) the defense is scheduled for.
  const { data: projectsData } = useAdminProjects({ limit: 100 });
  const projects = projectsData?.items ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    // النموذج يمسك نوع الإدخال، وonSubmit يستلم نوع الإخراج بعد التحويل.
  } = useForm<CreateDefenseFormValues, unknown, CreateDefenseInput>({
    resolver: zodResolver(createDefenseSchema),
    defaultValues: { groupId: "", date: "", room: "" },
  });

  useEffect(() => {
    if (open) reset({ groupId: "", date: "", room: "" });
  }, [open, reset]);

  function onSubmit(values: CreateDefenseInput) {
    // datetime-local gives "YYYY-MM-DDTHH:mm" → make it ISO for the backend
    const payload = clean({
      ...values,
      date: values.date ? new Date(values.date).toISOString() : values.date,
    });
    createDefense.mutate(payload, { onSuccess: () => onClose() });
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t("admin.scheduleDefense")}
      subtitle={t("admin.defenseDialogSubtitle")}
      icon={CalendarClock}
      footer={
        <>
          <button
            type="submit"
            form="defense-form"
            disabled={createDefense.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {createDefense.isPending ? t("admin.saving") : t("admin.saveData")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
        </>
      }
    >
      <form
        id="defense-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <Field
          label={t("admin.project")}
          icon={FolderKanban}
          error={errors.groupId?.message}
        >
          <select {...register("groupId")} className={inputClass}>
            <option value="">{t("admin.selectProject")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.topic?.title ?? p.id}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label={t("admin.defenseDate")}
            icon={CalendarClock}
            error={errors.date?.message}
          >
            <input
              type="datetime-local"
              {...register("date")}
              dir="ltr"
              className={inputClass}
            />
          </Field>
          <Field
            label={t("admin.room")}
            icon={MapPin}
            error={errors.room?.message}
          >
            <input
              {...register("room")}
              className={inputClass}
              placeholder={t("admin.roomPlaceholder")}
            />
          </Field>
        </div>

        <Field
          label={`${t("admin.grade")} (${t("admin.optional")})`}
          icon={Award}
          error={errors.grade?.message}
        >
          <input
            type="number"
            min={0}
            max={20}
            step="0.25"
            {...register("grade")}
            dir="ltr"
            className={inputClass}
            placeholder="0 - 20"
          />
        </Field>
      </form>
    </FormDialog>
  );
}
