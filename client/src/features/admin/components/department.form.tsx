import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Network, Type, Hash, Building2, Save } from "lucide-react";
import { FormDialog, Field, inputClass } from "./form-dialog";
import { departmentSchema, type DepartmentInput } from "../validation/admin.schema";
import {
  useCreateDepartment,
  useUpdateDepartment,
  useFaculties,
} from "../hooks/admin-hook";
import type { Department } from "../../../types/admin";

interface Props {
  open: boolean;
  onClose: () => void;
  department?: Department | null;
}

export function DepartmentFormDialog({ open, onClose, department }: Props) {
  const { t } = useTranslation();
  const isEdit = !!department;

  const { data: faculties } = useFaculties();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const pending = createDept.isPending || updateDept.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DepartmentInput>({
    resolver: zodResolver(departmentSchema),
  });

  // Populate (edit) or clear (create) when the dialog opens.
  useEffect(() => {
    if (open) {
      reset(
        department
          ? {
              name: department.name,
              code: department.code,
              facultyId: department.facultyId,
            }
          : { name: "", code: "", facultyId: "" },
      );
    }
  }, [open, department, reset]);

  function onSubmit(values: DepartmentInput) {
    if (isEdit && department) {
      updateDept.mutate(
        { id: department.id, data: values },
        { onSuccess: () => onClose() },
      );
    } else {
      createDept.mutate(values, { onSuccess: () => onClose() });
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("admin.editDepartment") : t("admin.addDepartment")}
      subtitle={t("admin.departmentDialogSubtitle")}
      icon={Network}
      footer={
        <>
          <button
            type="submit"
            form="department-form"
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
      <form
        id="department-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <Field
          label={t("admin.deptName")}
          icon={Type}
          error={errors.name?.message}
        >
          <input
            {...register("name")}
            className={inputClass}
            placeholder={t("admin.deptNamePlaceholder")}
          />
        </Field>

        <Field label={t("admin.code")} icon={Hash} error={errors.code?.message}>
          <input
            {...register("code")}
            dir="ltr"
            className={inputClass}
            placeholder="CS-UED"
          />
        </Field>

        <Field
          label={t("admin.faculty")}
          icon={Building2}
          error={errors.facultyId?.message}
        >
          <select {...register("facultyId")} className={inputClass}>
            <option value="">{t("admin.selectFaculty")}</option>
            {faculties?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </FormDialog>
  );
}
