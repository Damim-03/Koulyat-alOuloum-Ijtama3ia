import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  X,
  Trash2,
  Lock,
  Info,
  Send,
  CheckCircle2,
  Loader2,
  UserX,
  UserPlus,
  Crown,
  Users,
} from "lucide-react";
import {
  createGroupRequestSchema,
  type CreateGroupRequestInput,
} from "../validation/student.schema";
import { useCreateGroupRequest } from "../hooks/Student-hook";
import { studentApi } from "../api/Student-api";
import type { BrowseTopic, LookupStudent } from "../../../types/student.types";

interface Props {
  open: boolean;
  onClose: () => void;
  topic: BrowseTopic | null;
  /** يُستدعى بعد نجاح الإرسال — استخدمه للعودة إلى صفحة المواضيع. */
  onSubmitted?: () => void;
}

type LookupStatus = "idle" | "loading" | "found" | "notfound" | "dupe";

function nameOf(s: LookupStudent): string {
  return (
    [s.user?.firstName, s.user?.lastName].filter(Boolean).join(" ") ||
    s.registrationNumber ||
    ""
  );
}
function specOf(s: LookupStudent): string {
  return s.specialization?.name ?? "";
}

type MemberMeta = { name: string; spec: string };

export function GroupRequestDialog({
  open,
  onClose,
  topic,
  onSubmitted,
}: Props) {
  const { t } = useTranslation();
  const createReq = useCreateGroupRequest();
  const [memberInput, setMemberInput] = useState("");

  // ── live lookup state ──
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [found, setFound] = useState<LookupStudent | null>(null);
  const [meta, setMeta] = useState<Record<string, MemberMeta>>({});
  const reqId = useRef(0);

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

  const members = (watch("memberRegistrationNumbers") as string[]) ?? [];
  const membersRef = useRef(members);
  membersRef.current = members;

  // keep topicId synced when the topic changes
  if (topic && watch("topicId") !== topic.id) {
    setValue("topicId", topic.id);
  }

  // capacity: leader + teammates ≤ maxStudents
  const teammateCount = fields.length;
  const totalCount = teammateCount + 1; // +1 leader
  const overCapacity = !!topic && totalCount > topic.maxStudents;
  const atCapacity = !!topic && totalCount >= topic.maxStudents;

  // ── live search with debounce ──
  useEffect(() => {
    const reg = memberInput.trim();
    setFound(null);
    if (!reg) return setStatus("idle");
    if (membersRef.current.includes(reg)) return setStatus("dupe");
    setStatus("loading");
    const myId = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const s = await studentApi.lookupStudent(reg);
        if (myId !== reqId.current) return; // stale
        if (s) {
          setFound(s);
          setStatus("found");
        } else setStatus("notfound");
      } catch {
        if (myId === reqId.current) setStatus("notfound");
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [memberInput]);

  const canAdd =
    !!memberInput.trim() &&
    status === "found" &&
    !atCapacity &&
    !createReq.isPending;

  function addMember() {
    const reg = memberInput.trim();
    if (!reg || !canAdd) return;
    if (found)
      setMeta((m) => ({
        ...m,
        [reg]: { name: nameOf(found), spec: specOf(found) },
      }));
    append(reg as never);
    setMemberInput("");
    setStatus("idle");
    setFound(null);
  }

  function submit(data: CreateGroupRequestInput) {
    createReq.mutate(data, {
      onSuccess: () => {
        reset();
        setMeta({});
        onClose();
        onSubmitted?.(); // العودة إلى صفحة المواضيع (تتكفّل به الصفحة الأمّ)
      },
    });
  }

  if (!open || !topic) return null;

  const borderByStatus =
    status === "found"
      ? "border-emerald-400 focus:border-emerald-400 focus:ring-emerald-200/50"
      : status === "notfound" || status === "dupe"
        ? "border-red-400 focus:border-red-400 focus:ring-red-200/50"
        : "border-forest/15 focus:border-gold focus:ring-gold/25";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-forest-deep/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* shell */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-cream-card shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        {/* header */}
        <div className="relative bg-forest px-8 py-7">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-6 top-6 text-cream/50 transition hover:text-cream"
          >
            <X size={22} />
          </button>
          <div className="flex items-center gap-4 pl-10">
            <div className="grid size-14 shrink-0 place-items-center rounded-full bg-soft-sage/30 text-cream shadow-lg shadow-black/20">
              <Send size={26} />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-2xl font-bold leading-tight text-cream">
                {t("stu.requestModalTitle")}
              </h2>
              <p className="mt-0.5 truncate text-sm text-soft-sage">
                {topic.title}
              </p>
            </div>
          </div>
          {/* golden gradient line */}
          <div className="absolute inset-x-0 bottom-0 h-0.75 bg-linear-to-l from-gold/20 via-gold to-transparent" />
        </div>

        {/* body */}
        <form
          onSubmit={handleSubmit(submit)}
          className="flex-1 space-y-6 overflow-y-auto p-8"
        >
          {/* leader card */}
          <div className="flex items-center justify-between rounded-2xl border border-soft-sage/40 bg-cream-2 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-soft-sage/30 text-forest">
                <Crown size={22} />
              </div>
              <div>
                <p className="font-semibold text-forest">
                  {t("stu.youAreLeader")}
                </p>
                <p className="text-xs text-clay">{t("stu.leaderAutoAdded")}</p>
              </div>
            </div>
            <Lock size={20} className="shrink-0 text-clay/60" />
          </div>

          {/* teammates */}
          <div className="space-y-3">
            <div>
              <label className="block font-serif text-lg font-semibold text-forest">
                {t("stu.teammates")}
              </label>
              <p className="text-xs text-clay">{t("stu.teammatesHint")}</p>
            </div>

            {/* search row */}
            <div className="flex gap-3">
              <div className="relative flex-1">
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
                  disabled={atCapacity}
                  className={`w-full rounded-xl border-2 bg-cream px-4 py-3.5 text-sm text-forest outline-none transition focus:ring-4 disabled:opacity-50 ${borderByStatus}`}
                />
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
                  {status === "loading" && (
                    <Loader2 size={18} className="animate-spin text-clay" />
                  )}
                  {status === "found" && (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  )}
                  {status === "notfound" && (
                    <UserX size={18} className="text-red-500" />
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={addMember}
                disabled={!canAdd}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-forest px-6 py-3.5 text-sm font-semibold text-cream shadow-lg shadow-forest/10 transition hover:bg-forest-deep active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus size={18} />
                {t("stu.addMember")}
              </button>
            </div>

            {/* lookup status line */}
            <div className="min-h-[1.1rem] px-1 text-xs">
              {status === "loading" && (
                <span className="text-clay">{t("stu.lookingUp")}</span>
              )}
              {status === "found" && found && (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-emerald-700">
                  <span className="flex items-center gap-2">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-600" />
                    {t("stu.foundStudent")}:{" "}
                    <strong className="font-semibold">{nameOf(found)}</strong>
                  </span>
                  {specOf(found) && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                      {specOf(found)}
                    </span>
                  )}
                </span>
              )}
              {status === "notfound" && (
                <span className="text-red-600">{t("stu.studentNotFound")}</span>
              )}
              {status === "dupe" && (
                <span className="text-red-600">{t("stu.duplicateMember")}</span>
              )}
            </div>

            {/* members list */}
            {fields.length > 0 && (
              <div className="space-y-3 pt-1">
                {fields.map((f, i) => {
                  // eslint-disable-next-line react-hooks/incompatible-library
                  const reg = watch(`memberRegistrationNumbers.${i}`) as string;
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded-2xl border border-clay/15 bg-cream-2 p-4 transition hover:border-soft-sage/50 hover:bg-cream-card hover:shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                          <CheckCircle2 size={20} />
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-forest">
                              {meta[reg]?.name || reg}
                            </span>
                            {meta[reg]?.spec && (
                              <span className="rounded-full bg-soft-sage/25 px-2 py-0.5 text-[10px] text-sage">
                                {meta[reg].spec}
                              </span>
                            )}
                          </span>
                          <span
                            className="text-xs tracking-wide text-clay"
                            dir="ltr"
                          >
                            {reg}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="grid size-10 place-items-center rounded-xl text-clay transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* members count + priority */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              className={`flex items-center gap-2 ${overCapacity ? "font-bold text-red-500" : "text-clay"}`}
            >
              <Users size={18} />
              <span className="text-sm">
                {t("stu.capacityHint", {
                  total: totalCount,
                  max: topic.maxStudents,
                })}
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-clay/15 bg-cream-2 px-4 py-2">
              <label className="text-sm font-semibold text-forest">
                {t("stu.priority")}
              </label>
              <input
                type="number"
                min={1}
                max={10}
                {...register("priority")}
                className="w-14 rounded-lg border border-forest/15 bg-cream-card px-2 py-1.5 text-center text-sm font-bold text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
              />
              <span className="max-w-22.5 text-[10px] leading-tight text-clay">
                {t("stu.priorityHint")}
              </span>
            </div>
          </div>
          {errors.priority && (
            <p className="-mt-3 text-right text-[11px] text-red-500">
              {errors.priority.message}
            </p>
          )}

          {/* info box */}
          <div className="flex gap-3 rounded-2xl border border-soft-sage/40 bg-soft-sage/10 p-5">
            <Info size={20} className="mt-0.5 shrink-0 text-sage" />
            <p className="text-xs leading-relaxed text-clay">
              {t("stu.requestInfoNote")}
            </p>
          </div>
        </form>

        {/* footer */}
        <div className="flex items-center justify-start gap-3 border-t border-clay/10 bg-cream-2/40 px-8 py-5">
          <button
            type="button"
            onClick={() => handleSubmit(submit)()}
            disabled={createReq.isPending || overCapacity}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-7 py-3 font-bold text-forest-deep shadow-lg shadow-gold/20 transition hover:bg-gold-soft active:scale-95 disabled:opacity-50"
          >
            {createReq.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
            {t("stu.submitToAdmin")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-forest/20 px-6 py-3 font-semibold text-forest transition hover:border-forest hover:bg-forest/5"
          >
            {t("stu.cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
