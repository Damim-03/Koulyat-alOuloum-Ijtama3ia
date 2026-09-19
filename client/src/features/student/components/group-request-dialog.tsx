import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  X,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ListChecks,
  Hash,
  Lock,
  Info,
  Send,
  CheckCircle2,
  TriangleAlert,
  Loader2,
  UserX,
  SendHorizontal,
  Users,
} from "lucide-react";
import {
  createGroupRequestSchema,
  type CreateGroupRequestInput,
  type CreateGroupRequestFormValues,
} from "../validation/student.schema";
import {
  useCreateGroupRequest,
  useStudentLookup,
} from "../hooks/Student-hook";
import { useDebouncedValue } from "../../../hooks/use-debounced-value";
import { Stepper } from "../../../components/ui/stepper";
import { UserAvatar } from "../../../components/ui/user-avatar";
import type { BrowseTopic, LookupStudent } from "../../../types/student.types";

interface Props {
  open: boolean;
  onClose: () => void;
  topic: BrowseTopic | null;
  /** يُستدعى بعد نجاح الإرسال — استخدمه للعودة إلى صفحة المواضيع. */
  onSubmitted?: () => void;
}

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

/**
 * مقعدٌ واحد في المجموعة.
 *
 * كان الإدخال حقلاً واحداً وزرّ «إضافة» يُكرّر نفسه: يكتب الطالب رقماً،
 * يضغط، يُمحى الحقل، يكتب آخر — ولا يرى كم بقي له من مقعد إلّا في سطر عدٍّ
 * صغير. والمقاعد ظاهرةٌ الآن كما هي في الموضوع: ثلاثة طلبة ⇒ ثلاثة صفوف،
 * أوّلها المرسِل مقفلاً، وما بعده حقلٌ لكلّ زميل.
 *
 * ولكلّ مقعدٍ بحثُه: `useStudentLookup` خطّافٌ لا يُنادى في حلقة، فكلّ صفٍّ
 * مكوّنٌ قائمٌ بذاته يملك حالته ونتيجته.
 */
function MemberSlot({
  seat,
  value,
  onChange,
  onResolved,
  taken,
  topicSpec,
  disabled,
}: {
  seat: number;
  value: string;
  onChange: (text: string) => void;
  onResolved: (reg: string, meta: MemberMeta) => void;
  /** أرقام المقاعد الأخرى — لمنع تكرار الزميل نفسه. */
  taken: string[];
  /** تخصّص الموضوع — يُقارَن بتخصّص الزميل. */
  topicSpec?: string | null;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const reg = value.trim();
  const debounced = useDebouncedValue(reg, 350);
  const isDupe = reg.length > 0 && taken.includes(reg);
  const term = reg.length > 0 && !isDupe && debounced === reg ? reg : "";
  const lookup = useStudentLookup(term);

  const status = !reg
    ? "idle"
    : isDupe
      ? "dupe"
      : !term || lookup.isFetching
        ? "loading"
        : lookup.isSuccess && lookup.data
          ? "found"
          : lookup.isSuccess || lookup.isError
            ? "notfound"
            : "loading";

  const found = status === "found" ? (lookup.data ?? null) : null;

  /**
   * تخصّصٌ مختلف: تنبيهٌ لا منع.
   *
   * الموضوع مربوطٌ بتخصّص، والإدارة هي من يبتّ في طلبٍ يخالفه — فلا يُغلق
   * الباب هنا، لكن لا يُترك القائد يُرسل وهو لا يرى. والمقارنة بالاسم لأنّ
   * البحث لا يُرجع مُعرّف التخصّص؛ ولو غاب أحد الطرفين فلا حكم: غيابُ
   * المعلومة ليس اختلافاً.
   */
  const norm = (v?: string | null) => (v ?? "").trim();
  const mismatch =
    !!found &&
    !!norm(topicSpec) &&
    !!norm(specOf(found)) &&
    norm(specOf(found)) !== norm(topicSpec);

  useEffect(() => {
    if (found && reg)
      onResolved(reg, { name: nameOf(found), spec: specOf(found) });
  }, [found, reg, onResolved]);

  // رموز السمة لا ألوان ثابتة: `sage` و`brick` ينقلبان مع الوضع الداكن،
  // و`emerald-400` يبقى كما هو فيه.
  const ring = mismatch
    ? "border-gold focus:border-gold focus:ring-gold/25"
    : status === "found"
      ? "border-sage focus:border-sage focus:ring-sage/25"
      : status === "notfound" || status === "dupe"
        ? "border-brick/70 focus:border-brick focus:ring-brick/20"
        : "border-forest/15 focus:border-gold focus:ring-gold/25";

  /** إطار المقعد نفسه يقول حالته، فتُقرأ الصفوف الثلاثة بنظرة. */
  const seatTone = mismatch
    ? "border-gold/50 bg-gold/5"
    : status === "found"
      ? "border-sage/45 bg-sage/5"
      : status === "notfound" || status === "dupe"
        ? "border-brick/40 bg-brick/5"
        : "border-clay/15 bg-cream-2";

  return (
    <li
      className={`rounded-2xl border p-3 transition ${seatTone}`}
      data-testid={`seat-${seat}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-forest/10 text-sm font-bold text-forest">
          {seat}
        </span>
        <div className="relative flex-1">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("stu.regNumberPlaceholder")}
            dir="ltr"
            disabled={disabled}
            className={`w-full rounded-xl border-2 bg-cream pe-4 ps-11 py-2.5 text-sm text-forest outline-none transition focus:ring-4 disabled:opacity-50 ${ring}`}
          />
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
            {status === "loading" && (
              <Loader2 size={18} className="animate-spin text-clay" />
            )}
            {status === "found" &&
              (mismatch ? (
                <TriangleAlert size={18} className="text-gold" />
              ) : (
                <CheckCircle2 size={18} className="text-sage" />
              ))}
            {(status === "notfound" || status === "dupe") && (
              <UserX size={18} className="text-brick" />
            )}
          </span>
        </div>
      </div>

      {/*
        الجواب بطاقةُ طالبٍ لا سطرَ نصّ: من يُضاف إلى مجموعتك يُرى بوجهه
        ورقمه وتخصّصه قبل أن يُرسَل الطلب باسمه. وسطرٌ صغيرٌ بجانب حقلٍ
        يُقرأ سهواً — والخطأ بعده لا يُقرأ أصلاً.
      */}
      {status !== "idle" && (
        <div className="ps-12 pt-2">
          {status === "loading" && (
            <p className="flex items-center gap-2 text-xs text-clay">
              <Loader2 size={14} className="animate-spin" />
              {t("stu.lookingUp")}
            </p>
          )}

          {status === "found" && found && (
            <div
              className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                mismatch
                  ? "border-gold/40 bg-gold/10"
                  : "border-sage/35 bg-sage/10"
              }`}
            >
              <UserAvatar user={found.user} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-forest">
                  {nameOf(found)}
                </p>
                <p className="truncate text-[11px] text-clay">
                  <span dir="ltr">{found.registrationNumber}</span>
                </p>
              </div>
              {specOf(found) && (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    mismatch
                      ? "bg-gold/20 text-gold"
                      : "bg-sage/20 text-sage"
                  }`}
                >
                  {specOf(found)}
                </span>
              )}
              {mismatch ? (
                <TriangleAlert size={18} className="shrink-0 text-gold" />
              ) : (
                <CheckCircle2 size={18} className="shrink-0 text-sage" />
              )}
            </div>
          )}

          {status === "found" && mismatch && (
            <p className="mt-1.5 flex items-center gap-2 rounded-xl border border-gold/35 bg-gold/5 px-3 py-2 text-[11.5px] font-medium text-forest">
              <TriangleAlert size={14} className="shrink-0 text-gold" />
              {t("stu.specMismatch", { topic: norm(topicSpec) })}
            </p>
          )}

          {(status === "notfound" || status === "dupe") && (
            <p className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/5 px-3 py-2 text-xs font-medium text-brick">
              <UserX size={15} className="shrink-0" />
              {status === "dupe"
                ? t("stu.duplicateMember")
                : t("stu.studentNotFound")}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function GroupRequestDialog({
  open,
  onClose,
  topic,
  onSubmitted,
}: Props) {
  const { t } = useTranslation();
  const createReq = useCreateGroupRequest();
  const [stepIndex, setStepIndex] = useState(0);

  /** مقعدٌ لكل زميل: عدد الطلبة ناقصَ المرسِل. */
  const seats = Math.max(0, (topic?.maxStudents ?? 1) - 1);
  const [slots, setSlots] = useState<string[]>([]);
  const [meta, setMeta] = useState<Record<string, MemberMeta>>({});

  const {
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateGroupRequestFormValues, unknown, CreateGroupRequestInput>({
    resolver: zodResolver(createGroupRequestSchema),
    defaultValues: {
      topicId: topic?.id ?? "",
      priority: 1,
      memberRegistrationNumbers: [],
    },
  });

  // keep topicId synced when the topic changes
  if (topic && watch("topicId") !== topic.id) {
    setValue("topicId", topic.id);
  }

  const filled = slots.map((s) => s.trim()).filter(Boolean);
  const totalCount = filled.length + 1; // +1 leader

  /**
   * المقاعد هي مصدر الحقيقة، والاستمارة تتبعها في نفس المعالج — لا في أثرٍ
   * بعد الرسم. فما يُرسَل هو ما يراه الطالب في الصفوف، بلا وسيط.
   */
  function setSlot(i: number, text: string) {
    const next = [...slots];
    while (next.length < seats) next.push("");
    next[i] = text;
    setSlots(next);
    setValue(
      "memberRegistrationNumbers",
      next.map((s) => s.trim()).filter(Boolean),
      { shouldDirty: true },
    );
  }

  const remember = useCallback(
    (reg: string, m: MemberMeta) =>
      setMeta((prev) => (prev[reg]?.name === m.name ? prev : { ...prev, [reg]: m })),
    [],
  );

  /**
   * ثلاث خطوات: تُقرأ الشروط، ثم تُشكَّل المجموعة، ثم يُراجَع الطلب.
   *
   * ولا شيء يقع قبل الخطوة الأخيرة، فالرجوع مسموحٌ بلا ثمن — بخلاف معالج
   * الحذف في لوحة الإدارة، حيث تقع كل خطوةٍ فور الضغط.
   */
  const steps = [
    { key: "terms", label: t("stu.stepTerms") },
    { key: "members", label: t("stu.stepMembers") },
    { key: "review", label: t("stu.stepReview") },
  ];
  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index]!;
  const isLast = index === steps.length - 1;

  const requirements = topic?.requirements ?? [];
  const supervisorName =
    [topic?.professor?.user?.firstName, topic?.professor?.user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || t("stu.supervisor");

  function closeAll() {
    setStepIndex(0);
    onClose();
  }

  /**
   * ضغطة Enter داخل حقلٍ ترسل الاستمارة ضمنياً؛ ولو تُركت لأرسلت الطلب من
   * خطوة الشروط قبل أن يُملأ مقعدٌ واحد. فهنا تتحوّل إلى «التالي».
   */
  function onFormSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!isLast) {
      setStepIndex(index + 1);
      return;
    }
    void handleSubmit(submit)();
  }

  function submit(data: CreateGroupRequestInput) {
    createReq.mutate(data, {
      onSuccess: () => {
        reset();
        setMeta({});
        setSlots([]);
        setStepIndex(0);
        onClose();
        onSubmitted?.(); // العودة إلى صفحة المواضيع (تتكفّل به الصفحة الأمّ)
      },
    });
  }

  if (!open || !topic) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-forest-deep/60 backdrop-blur-md"
        onClick={closeAll}
      />

      {/* إطارٌ ثابتٌ لا أقصى: الخطوات الثلاث تختلف طولاً، ولو تمدّد الإطار
          بطول محتواه لقفز في كل انتقال وتحرّك زرّ «التالي» تحت الإصبع. */}
      <div className="relative z-10 flex h-[min(90vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-cream-card shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        {/* header */}
        <div className="relative shrink-0 bg-forest px-8 py-6">
          <button
            type="button"
            onClick={closeAll}
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
          <div className="absolute inset-x-0 bottom-0 h-0.75 bg-linear-to-l from-gold/20 via-gold to-transparent" />
        </div>

        {/* شريط الخطوات */}
        <div className="shrink-0 border-b border-clay/10 bg-cream-2/40 px-10 py-3">
          {/* الرجوع بالنقر مسموح: لا شيء يقع قبل الإرسال. */}
          <Stepper
            steps={steps}
            current={index}
            onGo={(i) => setStepIndex(i)}
            ariaLabel={t("stu.requestModalTitle")}
          />
        </div>

        {/* body */}
        <form
          onSubmit={onFormSubmit}
          className="min-h-0 flex-1 overflow-y-auto px-8 py-6"
        >
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {/* ══ الخطوة ١ — الشروط والملاحظات ══ */}
            {step.key === "terms" && (
              <>
                <section className="rounded-2xl border border-soft-sage/40 bg-cream-2 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold text-forest">
                    <ListChecks size={18} className="text-gold" />
                    {t("stu.selectionTerms")}
                  </h3>
                  {requirements.length > 0 ? (
                    <ul className="space-y-2.5">
                      {requirements.map((r, i) => (
                        <li key={i} className="flex gap-3 text-sm text-clay">
                          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-soft-sage/30 text-[11px] font-bold text-forest">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{r}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-clay">
                      {t("stu.noRequirements")}
                    </p>
                  )}
                </section>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-2xl border border-clay/15 bg-cream-2 p-4">
                    <Users size={18} className="mt-0.5 shrink-0 text-sage" />
                    <p className="text-[12.5px] leading-relaxed text-clay">
                      {t("stu.capacityRule", { max: topic.maxStudents })}
                    </p>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-clay/15 bg-cream-2 p-4">
                    <Hash size={18} className="mt-0.5 shrink-0 text-sage" />
                    <p className="text-[12.5px] leading-relaxed text-clay">
                      {t("stu.priorityHint")}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ══ الخطوة ٢ — المشرف وتشكيل المجموعة ══ */}
            {step.key === "members" && (
              <>
                <div className="flex items-center gap-4 rounded-2xl border border-clay/15 bg-cream-2 p-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-linear-to-br from-forest to-forest-deep text-cream">
                    <GraduationCap size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-forest">
                      {supervisorName}
                    </p>
                    <p className="text-xs text-clay">{t("stu.supervisor")}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-forest">
                        {t("stu.teammates")}
                      </h3>
                      <p className="text-xs text-clay">
                        {t("stu.teammatesHint")}
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 text-sm text-clay">
                      <Users size={16} />
                      {t("stu.capacityHint", {
                        total: totalCount,
                        max: topic.maxStudents,
                      })}
                    </span>
                  </div>

                  <ul className="space-y-2.5" data-testid="seats">
                    {/* المقعد الأوّل للمرسِل — مقفلٌ لأنه أنت. */}
                    <li className="flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/5 p-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/20 text-sm font-bold text-forest">
                          1
                        </span>
                        <div className="flex items-center gap-3">
                          <SendHorizontal size={20} className="text-forest" />
                          <div>
                            <p className="font-semibold text-forest">
                              {t("stu.youAreLeader")}
                            </p>
                            <p className="text-xs text-clay">
                              {t("stu.leaderAutoAdded")}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Lock size={18} className="shrink-0 text-clay/60" />
                    </li>

                    {Array.from({ length: seats }, (_, i) => {
                      const value = slots[i] ?? "";
                      return (
                        <MemberSlot
                          key={i}
                          seat={i + 2}
                          value={value}
                          onChange={(text) => setSlot(i, text)}
                          onResolved={remember}
                          taken={slots
                            .map((s) => s.trim())
                            .filter((s, j) => s && j !== i)}
                          topicSpec={topic.specialization?.name}
                          disabled={createReq.isPending}
                        />
                      );
                    })}
                  </ul>
                </div>

              </>
            )}

            {/* ══ الخطوة ٣ — مراجعة الطلب ══ */}
            {step.key === "review" && (
              <>
                <div className="rounded-2xl border border-clay/15 bg-cream-2 p-5">
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="shrink-0 text-xs font-semibold text-clay">
                        {t("stu.supervisor")}
                      </dt>
                      <dd className="text-forest">{supervisorName}</dd>
                    </div>
                    {/* الأولوية تُضبط هنا: آخر قرارٍ قبل الإرسال، وأمام
                        المراجعة كاملةً. */}
                    <div className="flex items-center justify-between gap-4 border-t border-clay/10 pt-2.5">
                      <dt className="shrink-0 text-xs font-semibold text-clay">
                        {t("stu.priority")}
                      </dt>
                      <dd className="flex items-center gap-3">
                        <span className="text-[11px] leading-tight text-clay">
                          {t("stu.priorityHint")}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          {...register("priority")}
                          className="w-16 rounded-lg border border-forest/15 bg-cream-card px-2 py-1.5 text-center text-sm font-bold text-forest outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
                        />
                      </dd>
                    </div>
                  </dl>
                  {errors.priority && (
                    <p className="mt-2 text-start text-[11px] text-red-500">
                      {errors.priority.message}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-clay/15 bg-cream-2 p-5">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-forest">
                    <Users size={16} className="text-gold" />
                    {t("stu.capacityHint", {
                      total: totalCount,
                      max: topic.maxStudents,
                    })}
                  </h4>
                  <ul className="space-y-2" data-testid="review-members">
                    <li className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/5 p-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/20 text-forest">
                        <SendHorizontal size={16} />
                      </span>
                      <span className="text-sm font-semibold text-forest">
                        {t("stu.youAreLeader")}
                      </span>
                    </li>
                    {filled.map((reg) => (
                      <li
                        key={reg}
                        className="flex items-center gap-3 rounded-xl border border-clay/15 bg-cream-card p-3"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                          <CheckCircle2 size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-forest">
                            {meta[reg]?.name || reg}
                          </span>
                          <span className="block text-[11px] text-clay">
                            <span dir="ltr">{reg}</span>
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {/* الملاحظة تُقرأ أوّلاً وتُراجَع أخيراً؛ وفي خطوة الإدخال تُزاحم. */}
            {step.key !== "members" && (
              <div className="flex gap-3 rounded-2xl border border-soft-sage/40 bg-soft-sage/10 p-5">
                <Info size={20} className="mt-0.5 shrink-0 text-sage" />
                <p className="text-xs leading-relaxed text-clay">
                  {t("stu.requestInfoNote")}
                </p>
              </div>
            )}
          </div>
        </form>

        {/* footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-clay/10 bg-cream-2/40 px-8 py-4">
          <span className="text-xs text-clay">
            {t("stu.stepOf", { current: index + 1, total: steps.length })}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeAll}
              className="rounded-xl border-2 border-forest/20 px-6 py-3 font-semibold text-forest transition hover:border-forest hover:bg-forest/5"
            >
              {t("stu.cancel")}
            </button>

            {index > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex(index - 1)}
                data-testid="request-back"
                className="inline-flex items-center gap-1 rounded-xl border-2 border-forest/20 px-5 py-3 font-semibold text-forest transition hover:border-forest hover:bg-forest/5"
              >
                <ChevronRight size={18} className="ltr:rotate-180" />
                {t("stu.back")}
              </button>
            )}

            {isLast ? (
              <button
                type="button"
                onClick={() => handleSubmit(submit)()}
                disabled={createReq.isPending}
                data-testid="request-submit"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-7 py-3 font-bold text-forest-deep shadow-lg shadow-gold/20 transition hover:bg-gold-soft active:scale-95 disabled:opacity-50"
              >
                {createReq.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                {t("stu.submitToAdmin")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex(index + 1)}
                data-testid="request-next"
                className="inline-flex items-center gap-1 rounded-xl bg-gold px-7 py-3 font-bold text-forest-deep shadow-lg shadow-gold/20 transition hover:bg-gold-soft active:scale-95"
              >
                {t("stu.next")}
                <ChevronLeft size={18} className="ltr:rotate-180" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
