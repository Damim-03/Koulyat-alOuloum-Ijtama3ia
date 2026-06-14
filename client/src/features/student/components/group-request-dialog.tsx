import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, Trash2, Crown, Info, Send } from "lucide-react";
import {
  createGroupRequestSchema,
  type CreateGroupRequestInput,
} from "../validation/student.schema";
import { useCreateGroupRequest } from "../hooks/Student-hook";
import type { BrowseTopic } from "../../../types/student.types";

interface Props {
  open: boolean;
  onClose: () => void;
  topic: BrowseTopic | null;
}

export function GroupRequestDialog({ open, onClose, topic }: Props) {
  const { t } = useTranslation();
  const createReq = useCreateGroupRequest();
  const [memberInput, setMemberInput] = useState("");

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateGroupRequestInput>({
    resolver: zodResolver(createGroupRequestSchema),
    defaultValues: {
      topicId: topic?.id ?? "",
      priority: 1,
      memberRegistrationNumbers: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "memberRegistrationNumbers" as never,
  });

  // keep topicId synced when the topic changes
  if (topic && watch("topicId") !== topic.id) {
    setValue("topicId", topic.id);
  }

  function addMember() {
    const v = memberInput.trim();
    if (!v) return;
    append(v as never);
    setMemberInput("");
  }

  function submit(data: CreateGroupRequestInput) {
    createReq.mutate(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  }

  if (!open || !topic) return null;

  // capacity: leader + teammates ≤ maxStudents
  const teammateCount = fields.length;
  const totalCount = teammateCount + 1; // +1 leader
  const overCapacity = totalCount > topic.maxStudents;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-forest-deep/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* shell */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-cream-card shadow-2xl">
        {/* header */}
        <div className="relative bg-forest px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-gold/20 text-gold">
              <Send size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-bold text-cream">
                {t("stu.requestModalTitle")}
              </h2>
              <p className="truncate text-xs text-cream/70">{topic.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute left-4 top-4 grid size-8 place-items-center rounded-lg text-cream/70 transition hover:bg-cream/10 hover:text-cream"
          >
            <X size={18} />
          </button>
        </div>
        {/* gold line */}
        <div className="h-0.5 bg-gradient-to-l from-gold to-gold-soft" />

        {/* body */}
        <form
          onSubmit={handleSubmit(submit)}
          className="max-h-[70vh] overflow-y-auto p-6"
        >
          {/* leader chip */}
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
            <Crown size={16} className="text-gold" />
            <div>
              <p className="text-xs font-bold text-forest">
                {t("stu.youAreLeader")}
              </p>
              <p className="text-[11px] text-clay">
                {t("stu.leaderAutoAdded")}
              </p>
            </div>
          </div>

          {/* teammates list builder */}
          <label className="mb-1.5 block text-sm font-semibold text-forest">
            {t("stu.teammates")}
          </label>
          <p className="mb-2 text-[11px] text-clay">{t("stu.teammatesHint")}</p>

          <div className="mb-2 flex gap-2">
            <input
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMember();
                }
              }}
              placeholder={t("stu.regNumberPlaceholder")}
              dir="ltr"
              className="flex-1 rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            <button
              type="button"
              onClick={addMember}
              className="inline-flex items-center gap-1 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-forest-deep"
            >
              <Plus size={16} />
              {t("stu.addMember")}
            </button>
          </div>

          {/* member chips */}
          {fields.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {fields.map((f, i) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-forest/10 bg-cream-2 px-3 py-2"
                >
                  <span className="text-sm text-forest" dir="ltr">
                    {watch(`memberRegistrationNumbers.${i}`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="grid size-7 place-items-center rounded-lg text-red-500 transition hover:bg-red-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* capacity hint */}
          <p
            className={`mb-4 text-[11px] ${overCapacity ? "font-bold text-red-500" : "text-clay"}`}
          >
            {t("stu.capacityHint", {
              total: totalCount,
              max: topic.maxStudents,
            })}
          </p>

          {/* priority */}
          <label className="mb-1.5 block text-sm font-semibold text-forest">
            {t("stu.priority")}
          </label>
          <input
            type="number"
            min={1}
            max={10}
            {...register("priority")}
            className="mb-1 w-full rounded-xl border border-forest/15 bg-cream-2 px-3 py-2.5 text-sm text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
          <p className="mb-4 text-[11px] text-clay">{t("stu.priorityHint")}</p>
          {errors.priority && (
            <p className="mb-3 text-[11px] text-red-500">
              {errors.priority.message}
            </p>
          )}

          {/* info box */}
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-gold/20 bg-gold/5 p-3">
            <Info size={16} className="mt-0.5 shrink-0 text-gold" />
            <p className="text-[11px] leading-relaxed text-clay">
              {t("stu.requestInfoNote")}
            </p>
          </div>

          {/* footer */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-forest/20 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
            >
              {t("stu.cancel")}
            </button>
            <button
              type="submit"
              disabled={createReq.isPending || overCapacity}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-forest-deep transition hover:bg-gold-soft disabled:opacity-50"
            >
              <Send size={16} />
              {t("stu.submitToAdmin")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
