import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { CalendarDays, Type, Save } from "lucide-react";
import { FormDialog, Field, inputClass } from "./form-dialog";
import { academicYearSchema, type AcademicYearInput } from "../validation/admin.schema";
import { useCreateAcademicYear, useUpdateAcademicYear } from "../hooks/admin-hook";
import type { AcademicYear } from "../../../types/admin";

interface Props {
  open: boolean;
  onClose: () => void;
  year?: AcademicYear | null;
}

export function AcademicYearFormDialog({ open, onClose, year }: Props) {
  const { t } = useTranslation();
  const isEdit = !!year;

  const createYear = useCreateAcademicYear();
  const updateYear = useUpdateAcademicYear();
  const pending = createYear.isPending || updateYear.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AcademicYearInput>({ resolver: zodResolver(academicYearSchema) });

  useEffect(() => {
    if (open) {
      reset(year ? { title: year.title, isActive: year.isActive } : { title: "", isActive: false });
    }
  }, [open, year, reset]);

  function onSubmit(values: AcademicYearInput) {
    if (isEdit && year) {
      updateYear.mutate({ id: year.id, data: values }, { onSuccess: () => onClose() });
    } else {
      createYear.mutate(values, { onSuccess: () => onClose() });
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("admin.editYear") : t("admin.addYear")}
      subtitle={t("admin.yearDialogSubtitle")}
      icon={CalendarDays}
      footer={
        <>
          <button
            type="submit"
            form="year-form"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {pending ? t("admin.saving") : t("admin.saveData")}
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
      <form id="year-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label={t("admin.yearTitle")} icon={Type} error={errors.title?.message}>
          <input {...register("title")} dir="ltr" className={inputClass} placeholder="2024/2025" />
        </Field>

        <label className="flex cursor-pointer items-center justify-between rounded-xl bg-cream-2 px-4 py-3">
          <span className="text-sm font-medium text-forest">{t("admin.setActiveYear")}</span>
          <input type="checkbox" {...register("isActive")} className="size-4 accent-gold" />
        </label>
      </form>
    </FormDialog>
  );
}