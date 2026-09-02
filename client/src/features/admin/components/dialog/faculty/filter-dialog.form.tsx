import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Network, Type, Hash, Save, Wand2 } from "lucide-react";
import type { Filiere } from "../../../../../types/admin";
import {
  useCreateFiliere,
  useUpdateFiliere,
  useFilieres,
} from "../../../hooks/admin-hook";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { CoverImageField } from "../../form/cover-image-field";
import { generateCode } from "../../../utils/generate-code";

interface FiliereFormDialogProps {
  open: boolean;
  onClose: () => void;
  filiere: Filiere | null;
  domainId: string;
}

export function FiliereFormDialog({
  open,
  onClose,
  filiere,
  domainId,
}: FiliereFormDialogProps) {
  const { t } = useTranslation();
  const createFiliere = useCreateFiliere();
  const updateFiliere = useUpdateFiliere();
  const { data: filieres } = useFilieres();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(filiere);

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(filiere?.name ?? "");
      setCode(filiere?.code ?? "");
      setCoverUrl(filiere?.coverUrl ?? "");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, filiere]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName || !trimmedCode) return;

    // domainId فقط — الخادم يشتقّ departmentId من الميدان.
    const payload = {
      name: trimmedName,
      code: trimmedCode,
      coverUrl,
      domainId,
    };

    setSubmitting(true);
    try {
      if (isEdit && filiere) {
        await updateFiliere.mutateAsync({ id: filiere.id, data: payload });
      } else {
        await createFiliere.mutateAsync(payload);
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
      title={isEdit ? t("admin.editFiliere") : t("admin.newFiliere")}
      subtitle={t("admin.filiereDialogSubtitle")}
      icon={Network}
      footer={
        <>
          <button
            type="submit"
            form="filiere-form"
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
      <form id="filiere-form" onSubmit={handleSubmit} className="space-y-4">
        <CoverImageField value={coverUrl} onChange={setCoverUrl} />

        <Field label={t("admin.filiereName")} icon={Type}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder={t("admin.filiereName")}
          />
        </Field>

        <Field label={t("admin.filiereCode")} icon={Hash}>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              dir="ltr"
              className={`${inputClass} flex-1 font-mono`}
              placeholder={t("admin.filiereCodePlaceholder")}
            />
            <button
              type="button"
              onClick={() =>
                setCode(generateCode("S", filieres ?? [], filiere?.id))
              }
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
