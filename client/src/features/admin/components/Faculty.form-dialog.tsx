import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Building2, Type, Hash, Save, Wand2 } from "lucide-react";
import { FormDialog, Field, inputClass } from "./form-dialog";
import { facultySchema, type FacultyInput } from "../validation/admin.schema";
import {
  useCreateFaculty,
  useUpdateFaculty,
  useFaculties,
} from "../hooks/admin-hook";
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
  const { data: faculties } = useFaculties();
  const pending = createFaculty.isPending || updateFaculty.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FacultyInput>({ resolver: zodResolver(facultySchema) });

  useEffect(() => {
    if (open) {
      reset(
        faculty
          ? { name: faculty.name, code: faculty.code }
          : { name: "", code: "" },
      );
    }
  }, [open, faculty, reset]);

  /**
   * يولّد رمزاً بنفس شكل الرموز الحالية (F + ثلاثة أحرف كبيرة، مثل FST)
   * ويضمن ألّا يكون مستخدَماً من قِبل كلية أخرى. الخادم يبقى الضامن النهائي
   * للتفرّد عبر قيد @unique.
   */
  function generateCode() {
    const taken = new Set(
      (faculties ?? [])
        .filter((f) => f.id !== faculty?.id) // لا نحسب رمز الكلية نفسها عند التعديل
        .map((f) => (f.code ?? "").toUpperCase()),
    );
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    // eslint-disable-next-line no-useless-assignment
    let code = "";
    do {
      let rest = "";
      for (let i = 0; i < 3; i++)
        rest += LETTERS[Math.floor(Math.random() * LETTERS.length)];
      code = "F" + rest;
    } while (taken.has(code));

    setValue("code", code, { shouldValidate: true, shouldDirty: true });
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
