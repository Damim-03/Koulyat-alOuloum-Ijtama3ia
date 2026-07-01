import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import {
  useCreateSpecialization,
  useUpdateSpecialization,
} from "../hooks/admin-hook";
import type { Specialization } from "../../../types/admin";

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
  const [submitting, setSubmitting] = useState(false);

  const isEdit = Boolean(specialization);

  useEffect(() => {
    if (open) {
      setName(specialization?.name ?? "");
      setLevel((specialization?.level as Level) ?? "licence");
    }
  }, [open, specialization]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const payload = { name: trimmedName, level, filiereId };

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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-forest-deep/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        dir="rtl"
        className="w-full max-w-md rounded-2xl bg-cream-card p-6 shadow-[0_20px_60px_rgba(38,66,61,0.25)]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-forest">
            {isEdit
              ? t("admin.editSpecialization")
              : t("admin.newSpecialization")}
          </h2>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-clay transition hover:bg-forest/5 hover:text-forest"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-right text-sm font-medium text-forest">
              {t("admin.specializationName")}
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              dir="rtl"
              className="w-full rounded-xl border border-forest/15 bg-cream px-3.5 py-2.5 text-right text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-right text-sm font-medium text-forest">
              {t("admin.specializationLevel")}
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              dir="rtl"
              className="w-full rounded-xl border border-forest/15 bg-cream px-3.5 py-2.5 text-right text-sm text-forest outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/20"
            >
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {t(LEVEL_LABEL[lv])}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-start gap-2 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "\u2026" : t("admin.save")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-forest/15 px-5 py-2.5 text-sm font-medium text-clay transition hover:bg-forest/5"
            >
              {t("admin.cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
