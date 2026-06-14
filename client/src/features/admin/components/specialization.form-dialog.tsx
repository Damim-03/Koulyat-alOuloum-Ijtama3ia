import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Layers, Type, GraduationCap, Network, Save } from "lucide-react";
import { FormDialog, Field, inputClass } from "./form-dialog";
import { specializationSchema, type SpecializationInput } from "../validation/admin.schema";
import { useCreateSpecialization, useUpdateSpecialization, useDepartments } from "../hooks/admin-hook";
import type { Specialization } from "../../../types/admin";

interface Props {
  open: boolean;
  onClose: () => void;
  specialization?: Specialization | null;
}

export function SpecializationFormDialog({ open, onClose, specialization }: Props) {
  const { t } = useTranslation();
  const isEdit = !!specialization;

  const { data: departments } = useDepartments();
  const createSpec = useCreateSpecialization();
  const updateSpec = useUpdateSpecialization();
  const pending = createSpec.isPending || updateSpec.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SpecializationInput>({ resolver: zodResolver(specializationSchema) });

  useEffect(() => {
    if (open) {
      reset(
        specialization
          ? { name: specialization.name, level: specialization.level, departmentId: specialization.departmentId }
          : { name: "", level: "licence", departmentId: "" },
      );
    }
  }, [open, specialization, reset]);

  function onSubmit(values: SpecializationInput) {
    if (isEdit && specialization) {
      updateSpec.mutate({ id: specialization.id, data: values }, { onSuccess: () => onClose() });
    } else {
      createSpec.mutate(values, { onSuccess: () => onClose() });
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("admin.editSpecialization") : t("admin.addSpecialization")}
      subtitle={t("admin.specializationDialogSubtitle")}
      icon={Layers}
      footer={
        <>
          <button
            type="submit"
            form="specialization-form"
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
      <form id="specialization-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label={t("admin.specName")} icon={Type} error={errors.name?.message}>
          <input {...register("name")} className={inputClass} placeholder={t("admin.specNamePlaceholder")} />
        </Field>

        <Field label={t("admin.level")} icon={GraduationCap} error={errors.level?.message}>
          <select {...register("level")} className={inputClass}>
            <option value="licence">{t("admin.level_licence")}</option>
            <option value="master">{t("admin.level_master")}</option>
            <option value="doctorate">{t("admin.level_doctorate")}</option>
          </select>
        </Field>

        <Field label={t("admin.department")} icon={Network} error={errors.departmentId?.message}>
          <select {...register("departmentId")} className={inputClass}>
            <option value="">{t("admin.selectDepartment")}</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </Field>
      </form>
    </FormDialog>
  );
}