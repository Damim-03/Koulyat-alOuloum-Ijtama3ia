import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Compass, Type, Hash, Save, Wand2 } from "lucide-react";
import type { Domain } from "../../../../../types/admin";
import {
  useCreateDomain,
  useUpdateDomain,
  useDomains,
} from "../../../hooks/admin-hook";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { CoverImageField } from "../../form/cover-image-field";
import { generateCode } from "../../../utils/generate-code";

interface DomainFormDialogProps {
  open: boolean;
  onClose: () => void;
  domain: Domain | null;
  departmentId: string;
}

export function DomainFormDialog({
  open,
  onClose,
  domain,
  departmentId,
}: DomainFormDialogProps) {
  const { t } = useTranslation();
  const createDomain = useCreateDomain();
  const updateDomain = useUpdateDomain();
  const { data: domains } = useDomains();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(domain);

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(domain?.name ?? "");
      setCode(domain?.code ?? "");
      setCoverUrl(domain?.coverUrl ?? "");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, domain]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName || !trimmedCode) return;

    // An empty cover clears it; the server maps "" to null.
    const payload = {
      name: trimmedName,
      code: trimmedCode,
      coverUrl,
      departmentId,
    };

    setSubmitting(true);
    try {
      if (isEdit && domain) {
        await updateDomain.mutateAsync({ id: domain.id, data: payload });
      } else {
        await createDomain.mutateAsync(payload);
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
      title={isEdit ? t("admin.editDomain") : t("admin.newDomain")}
      subtitle={t("admin.domainDialogSubtitle")}
      icon={Compass}
      footer={
        <>
          <button
            type="submit"
            form="domain-form"
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
      <form id="domain-form" onSubmit={handleSubmit} className="space-y-4">
        <CoverImageField value={coverUrl} onChange={setCoverUrl} />

        <Field label={t("admin.domainName")} icon={Type}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder={t("admin.domainName")}
          />
        </Field>

        <Field label={t("admin.domainCode")} icon={Hash}>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              dir="ltr"
              className={`${inputClass} flex-1 font-mono`}
              placeholder="DOM"
            />
            <button
              type="button"
              onClick={() =>
                setCode(
                  generateCode("M", domains ?? [], domain?.id),
                )
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
