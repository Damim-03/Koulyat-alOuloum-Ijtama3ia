import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Building2, Type, Hash, Save, Wand2 } from "lucide-react";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { CoverImageField } from "../../form/cover-image-field";
import { generateCode as suggestCode } from "../../../utils/generate-code";
import type { Faculty } from "../../../../../types/admin";
import {
  useCreateFaculty,
  useUpdateFaculty,
  useFaculties,
} from "../../../hooks/admin-hook";
import {
  type FacultyInput,
  facultySchema,
} from "../../../validation/admin.schema";

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
  const { data: faculties } = useFaculties();
  const pending = createFaculty.isPending || updateFaculty.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FacultyInput>({ resolver: zodResolver(facultySchema) });

  const coverUrl = useWatch({ control, name: "coverUrl" });

  useEffect(() => {
    if (open) {
      reset(
        faculty
          ? {
              name: faculty.name,
              code: faculty.code,
              coverUrl: faculty.coverUrl ?? "",
            }
          : { name: "", code: "", coverUrl: "" },
      );
    }
  }, [open, faculty, reset]);

  function generateCode() {
    setValue("code", suggestCode("F", faculties ?? [], faculty?.id), {
      shouldValidate: true,
      shouldDirty: true,
    });
  }

  function onSubmit(values: FacultyInput) {
    if (isEdit && faculty) {
      updateFaculty.mutate(
        { id: faculty.id, data: values },
        { onSuccess: () => onClose() },
      );
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
      <form
        id="faculty-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <CoverImageField
          value={coverUrl}
          onChange={(url) =>
            setValue("coverUrl", url, { shouldDirty: true })
          }
        />

        <Field
          label={t("admin.facultyName")}
          icon={Type}
          error={errors.name?.message}
        >
          <input
            {...register("name")}
            className={inputClass}
            placeholder={t("admin.facultyNamePlaceholder")}
          />
        </Field>

        <Field label={t("admin.code")} icon={Hash} error={errors.code?.message}>
          <div className="flex gap-2">
            <input
              {...register("code")}
              dir="ltr"
              className={`${inputClass} flex-1`}
              placeholder="FST"
            />
            <button
              type="button"
              onClick={generateCode}
              title={t("admin.generateCode")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-forest/15 bg-cream-2 px-3 text-sm font-semibold text-forest transition hover:border-gold hover:text-gold"
            >
              <Wand2 size={16} />
              {t("admin.generateCode")}
            </button>
          </div>
        </Field>
      </form>
    </FormDialog>
  );
}
