import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useCreateTopic, useUpdateTopic } from "../hooks/Professor-hook";
import type { Topic } from "../../../types/professor.types";

interface Props {
  open: boolean;
  onClose: () => void;
  topic?: Topic | null; // when set → edit mode
}

export function TopicFormDialog({ open, onClose, topic }: Props) {
  const { t } = useTranslation();
  const { dir } = useLanguage();
  const create = useCreateTopic();
  const update = useUpdateTopic();
  const editing = !!topic;

  const [form, setForm] = useState({
    title: "",
    description: "",
    maxStudents: 1,
    specializationId: "",
    academicYearId: "",
  });

  useEffect(() => {
    if (topic) {
      setForm({
        title: topic.title,
        description: topic.description,
        maxStudents: topic.maxStudents,
        specializationId: topic.specializationId,
        academicYearId: topic.academicYearId,
      });
    } else {
      setForm({
        title: "",
        description: "",
        maxStudents: 1,
        specializationId: "",
        academicYearId: "",
      });
    }
  }, [topic, open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      update.mutate(
        {
          id: topic!.id,
          data: {
            title: form.title,
            description: form.description,
            maxStudents: Number(form.maxStudents),
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(
        { ...form, maxStudents: Number(form.maxStudents) },
        { onSuccess: onClose },
      );
    }
  };

  const busy = create.isPending || update.isPending;
  const field =
    "w-full rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm text-forest outline-none focus:border-gold";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        dir={dir}
        className="relative w-full max-w-lg rounded-2xl border border-forest/10 bg-cream-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-forest">
            {editing ? t("pro.edit") : t("pro.newTopic")}
          </h3>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-clay hover:bg-forest/5"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-[13px] font-medium text-forest">
              {t("pro.title")}
            </label>
            <input
              className={field}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-forest">
              {t("pro.description")}
            </label>
            <textarea
              className={`${field} min-h-24 resize-y`}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-[13px] font-medium text-forest">
              {t("pro.maxStudents")}
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className={field}
              value={form.maxStudents}
              onChange={(e) =>
                setForm({ ...form, maxStudents: Number(e.target.value) })
              }
              required
            />
          </div>

          {!editing && (
            <>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                {t("pro.idsHint")}
              </p>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-forest">
                  {t("pro.specializationId")}
                </label>
                <input
                  className={field}
                  value={form.specializationId}
                  onChange={(e) =>
                    setForm({ ...form, specializationId: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-[13px] font-medium text-forest">
                  {t("pro.academicYearId")}
                </label>
                <input
                  className={field}
                  value={form.academicYearId}
                  onChange={(e) =>
                    setForm({ ...form, academicYearId: e.target.value })
                  }
                  required
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-forest/15 px-4 py-2 text-sm font-medium text-clay hover:bg-forest/5"
            >
              {t("pro.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-linear-to-br from-gold to-gold-soft px-5 py-2 text-sm font-bold text-forest-deep disabled:opacity-60"
            >
              {editing ? t("pro.save") : t("pro.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
