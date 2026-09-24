import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Building2, Type, Hash, Save } from "lucide-react";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { CoverImageField } from "../../form/cover-image-field";
import {
  generateCode,
  isStampedCode,
} from "../../../utils/generate-code";
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
  const iconUrl = useWatch({ control, name: "iconUrl" });

  useEffect(() => {
    if (open) {
      reset(
        faculty
          ? {
              name: faculty.name,
              // ورمزُ ما قبل هذا التغيير يُستبدل عند أوّل تعديل:
              // انظر `isStampedCode`.
              code: isStampedCode(faculty.code)
                ? faculty.code
                : generateCode("F", faculties ?? [], faculty.id),
              coverUrl: faculty.coverUrl ?? "",
              iconUrl: faculty.iconUrl ?? "",
            }
          : {
              name: "",
              // انظر تعليق «الرمز يُصكّ عند الفتح» في حوار القسم.
              code: generateCode("F", faculties ?? []),
              coverUrl: "",
              iconUrl: "",
            },
      );
    }
    /*
     * القائمة خارج التبعيات عمداً: هي لتجنّب رمزٍ مأخوذ لا غير، وإدخالها
     * يُعيد تشغيل الأثر كلّما وصلت من الخادم — فيُصكّ رمزٌ جديد والنافذة
     * مفتوحة، ويتبدّل ما يقرؤه المستعمل.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, faculty, reset]);

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
        {/*
          صورتان لا صورة: الغلاف شريطٌ عريض خلف البطاقة، والشعار علامةٌ
          مربّعة تحلّ محلّ أيقونة المبنى الافتراضية وتُقرأ في أربعين بكسلاً.
          وكلتاهما اختيارية، وتُرفع وحدها فور اختيارها فيبقى الحفظ نداءً
          واحداً من JSON.

          ولوحةٌ واحدة تضمّهما: كانتا صندوقين طافيين بلا رابطٍ بينهما، فتُقرأ
          النافذة خمسَ كتلٍ متساوية الوزن. والآن كتلتان: «صور الكلّية» ثمّ
          بياناتها.
        */}
        <fieldset className="rounded-2xl border border-forest/12 bg-cream-2/40 p-3.5">
          <legend className="px-1.5 text-[11px] font-bold text-clay">
            {t("admin.facultyImages")}
          </legend>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <CoverImageField
                value={coverUrl}
                onChange={(url) =>
                  setValue("coverUrl", url, { shouldDirty: true })
                }
              />
            </div>
            <CoverImageField
              variant="icon"
              label={t("admin.iconImage")}
              value={iconUrl}
              onChange={(url) => setValue("iconUrl", url, { shouldDirty: true })}
            />
          </div>
        </fieldset>

        <Field
          label={t("admin.facultyName")}
          icon={Type}
          error={errors.name?.message}
        >
          {/*
            الرمز يُملأ تلقائياً عند أوّل كتابةٍ للاسم والرمزُ فارغ، فلا
            يحتاج زرّ «توليد» إلّا لتبديلٍ متعمَّد. ولا يُملأ إلّا مرّة:
            توليدٌ عند كل حرفٍ يبدّل الرمز تحت عين من يقرؤه.
          */}
          <input
            {...register("name")}
            className={inputClass}
            placeholder={t("admin.facultyNamePlaceholder")}
          />
        </Field>

        <Field label={t("admin.code")} icon={Hash} error={errors.code?.message}>
          {/* انظر تعليق «الرمز مولَّدٌ ومقفل» في حوار القسم. */}
          <input
            {...register("code")}
            readOnly
            dir="ltr"
            aria-readonly="true"
            className={`${inputClass} cursor-not-allowed bg-forest/5 font-mono text-clay`}
            placeholder={t("admin.codeAuto")}
          />
        </Field>
      </form>
    </FormDialog>
  );
}
