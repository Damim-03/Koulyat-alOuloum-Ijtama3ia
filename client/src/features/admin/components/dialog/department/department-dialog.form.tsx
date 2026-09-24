import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Landmark, Type, Hash, Save } from "lucide-react";
import type { Department } from "../../../../../types/admin";
import {
  useCreateDepartment,
  useUpdateDepartment,
  useDepartments,
} from "../../../hooks/admin-hook";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { CoverImageField } from "../../form/cover-image-field";
import {
  generateCode,
  isStampedCode,
} from "../../../utils/generate-code";

interface DepartmentFormDialogProps {
  open: boolean;
  onClose: () => void;
  department: Department | null;
  facultyId: string;
}

export function DepartmentFormDialog({
  open,
  onClose,
  department,
  facultyId,
}: DepartmentFormDialogProps) {
  const { t } = useTranslation();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const { data: departments } = useDepartments();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(department);

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(department?.name ?? "");
      // الرمز يُصكّ عند الفتح لا عند أوّل حرفٍ من الاسم: هو ختمُ وقتٍ لا
      // يشتقّ من الاسم في شيء، فلا معنى لانتظاره — والحقل مقفل، فالفراغ
      // فيه يسأل المستعمل عمّا لا يملك جوابه.
      // ورمزُ ما قبل هذا التغيير يُستبدل عند أوّل تعديل: انظر `isStampedCode`.
      setCode(
        isStampedCode(department?.code)
          ? department!.code!
          : generateCode("D", departments ?? [], department?.id),
      );
      setCoverUrl(department?.coverUrl ?? "");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    /*
     * القائمة خارج التبعيات عمداً: هي لتجنّب رمزٍ مأخوذ لا غير، وإدخالها
     * يُعيد تشغيل الأثر كلّما وصلت من الخادم — فيُصكّ رمزٌ جديد والنافذة
     * مفتوحة، ويتبدّل ما يقرؤه المستعمل.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, department]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName || !trimmedCode) return;

    const payload = {
      name: trimmedName,
      code: trimmedCode,
      coverUrl,
      facultyId,
    };

    setSubmitting(true);
    try {
      if (isEdit && department) {
        await updateDept.mutateAsync({ id: department.id, data: payload });
      } else {
        await createDept.mutateAsync(payload);
      }
      onClose();
    } catch {
      // الأخطاء تظهر عبر toast داخل الـ hook
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.trim() !== "" && code.trim() !== "" && !submitting;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={isEdit ? t("admin.editDepartment") : t("admin.newDepartment")}
      subtitle={t("admin.departmentDialogSubtitle")}
      icon={Landmark}
      footer={
        <>
          <button
            type="submit"
            form="department-form"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {submitting ? t("admin.saving") : t("admin.saveData")}
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
      <form id="department-form" onSubmit={handleSubmit} className="space-y-4">
        <CoverImageField value={coverUrl} onChange={setCoverUrl} />

          {/*
            الرمز يُملأ تلقائياً عند أوّل كتابةٍ للاسم والرمزُ فارغ، فلا
            يحتاج زرّ «توليد» إلّا لتبديلٍ متعمَّد. ولا يُملأ إلّا مرّة:
            توليدٌ عند كل حرفٍ يبدّل الرمز تحت عين من يقرؤه.
          */}
        <Field label={t("admin.departmentName")} icon={Type}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder={t("admin.departmentName")}
          />
        </Field>

        <Field label={t("admin.departmentCode")} icon={Hash}>
          <div className="flex gap-2">
            {/*
              الرمز مولَّدٌ ومقفل: يُعرض ولا يُكتب.
              يُملأ من تلقائه عند أوّل حرفٍ من الاسم، فلا زرَّ توليدٍ بعده
              ولا كتابةً يدوية. ورمزٌ يكتبه كلٌّ بهواه يُفقد الشكل الموحَّد،
              ويصطدم بقيد `@unique` في الخادم فيُردّ الحفظ بخطأٍ لا يفهمه
              من كتبه. والتعديل لا يمسّ رمزاً محفوظاً: غيرُه قد يشير إليه.
            */}
            <input
              value={code}
              readOnly
              dir="ltr"
              aria-readonly="true"
              className={`${inputClass} flex-1 cursor-not-allowed bg-forest/5 font-mono text-clay`}
              placeholder={t("admin.codeAuto")}
            />
          </div>
        </Field>
      </form>
    </FormDialog>
  );
}
