import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Layers3, Type, GraduationCap, Save } from "lucide-react";
import type { Specialization } from "../../../../../types/admin";
import {
  useCreateSpecialization,
  useUpdateSpecialization,
} from "../../../hooks/admin-hook";
import { FormDialog, Field, inputClass } from "../../form/form-dialog";
import { CoverImageField } from "../../form/cover-image-field";

type Level = "licence" | "master" | "doctorate";
const LEVELS: Level[] = ["licence", "master", "doctorate"];
const LEVEL_LABEL: Record<Level, string> = {
  licence: "admin.levelLicence",
  master: "admin.levelMaster",
  doctorate: "admin.levelDoctorate",
};

interface SpecializationFormDialogProps {
  open: boolean;
  onClose: () => void;
  specialization: Specialization | null;
  filiereId: string;
}

export function SpecializationFormDialog({
  open,
  onClose,
  specialization,
  filiereId,
}: SpecializationFormDialogProps) {
  const { t } = useTranslation();
  const createSpec = useCreateSpecialization();
  const updateSpec = useUpdateSpecialization();

  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("licence");
  const [coverUrl, setCoverUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(specialization);

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(specialization?.name ?? "");
      setLevel((specialization?.level as Level) ?? "licence");
      setCoverUrl(specialization?.coverUrl ?? "");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, specialization]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const payload = { name: trimmedName, level, coverUrl, filiereId };

    setSubmitting(true);
    try {
      if (isEdit && specialization) {
        await updateSpec.mutateAsync({ id: specialization.id, data: payload });
      } else {
        await createSpec.mutateAsync(payload);
      }
      onClose();
    } catch {
      // الأخطاء تظهر عبر toast داخل الـ hook
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.trim() !== "" && !submitting;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={
        isEdit ? t("admin.editSpecialization") : t("admin.newSpecialization")
      }
      subtitle={t("admin.specializationsSubtitle")}
      icon={Layers3}
      footer={
        <>
          <button
            type="submit"
            form="specialization-form"
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
      <form
        id="specialization-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <CoverImageField value={coverUrl} onChange={setCoverUrl} />

        <Field label={t("admin.specializationName")} icon={Type}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder={t("admin.specializationName")}
          />
        </Field>

        <Field label={t("admin.specializationLevel")} icon={GraduationCap}>
          {/* One tap per level reads better than a select for three options. */}
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  level === lv
                    ? "border-gold bg-gold/15 text-forest"
                    : "border-forest/15 bg-cream-2 text-clay hover:border-gold/50 hover:text-forest"
                }`}
              >
                {t(LEVEL_LABEL[lv])}
              </button>
            ))}
          </div>
        </Field>
      </form>
    </FormDialog>
  );
}
