import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Building2, Type, Hash, Save } from "lucide-react";
import { FormDialog, Field, inputClass } from "./form-dialog";
import { facultySchema, type FacultyInput } from "../validation/admin.schema";
import { useCreateFaculty, useUpdateFaculty } from "../hooks/admin-hook";
import type { Faculty } from "../../../types/admin";

interface Props {
  open: boolean;
  onClose: () => void;
  faculty?: Faculty | null;
}

export function FacultyFormDialog({ open, onClose, faculty }: Props) {
  const { t } = useTranslation();
  const isEdit = !!faculty;

  const createFaculty = useCreateFaculty();
  const updateFaculty = useUpdateFaculty();
  const pending = createFaculty.isPending || updateFaculty.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FacultyInput>({ resolver: zodResolver(facultySchema) });

  useEffect(() => {
    if (open) {
      reset(faculty ? { name: faculty.name, code: faculty.code } : { name: "", code: "" });
    }
  }, [open, faculty, reset]);

  function onSubmit(values: FacultyInput) {
    if (isEdit && faculty) {
      updateFaculty.mutate({ id: faculty.id, data: values }, { onSuccess: () => onClose() });
    } else {
      createFaculty.mutate(values, { onSuccess: () => onClose() });
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("admin.editFaculty") : t("admin.addFaculty")}
      subtitle={t("admin.facultyDialogSubtitle")}
      icon={Building2}
      footer={
        <>
          <button
            type="submit"
            form="faculty-form"
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
      <form id="faculty-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label={t("admin.facultyName")} icon={Type} error={errors.name?.message}>
          <input {...register("name")} className={inputClass} placeholder={t("admin.facultyNamePlaceholder")} />
        </Field>

        <Field label={t("admin.code")} icon={Hash} error={errors.code?.message}>
          <input {...register("code")} dir="ltr" className={inputClass} placeholder="FST" />
        </Field>
      </form>
    </FormDialog>
  );
}