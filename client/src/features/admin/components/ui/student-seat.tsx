import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Loader2,
  SendHorizontal,
  Star,
  TriangleAlert,
  UserX,
  X,
} from "lucide-react";
import { useStudents } from "../../hooks/admin-hook";
import { useDebouncedValue } from "../../../../hooks/use-debounced-value";
import { UserAvatar } from "../../../../components/ui/user-avatar";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SeatStudent {
  id: string;
  name: string;
  reg: string;
  user?: any;
}

const nameOf = (u: any) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();

/**
 * مقعدُ طالبٍ في موضوعٍ مُسنَد.
 *
 * كان الإسناد صندوقَ بحثٍ واحداً يُضيف إلى قائمةٍ حتى تمتلئ: لا يُرى كم
 * بقي، ولا يُعرف — قبل الإضافة — أنّ الموضوع لا يتّسع إلا لواحد. والعدد
 * معروفٌ من `maxStudents` منذ الخطوة الأولى، فصار لكلّ طالبٍ مقعدٌ مرقَّم
 * يُملأ برقم تسجيله، كما في نافذة طلب المجموعة عند الطالب.
 *
 * **ولا يكون المقعد أشدَّ من الخادم.** كان البحث مقصوراً على طلبة التخصّص
 * المختار، و`createAssignedTopicService` لا يفحص التخصّص أصلاً: يفحص وجود
 * الطلبة وألّا يكون لأحدهم مشروع. فكان رقمٌ صحيحٌ لطالبٍ حرٍّ يُردّ بـ«لا
 * طالب بهذا الرقم» لأنّ تخصّصه غير تخصّص الموضوع — وهو إسنادٌ يقبله الخادم.
 * فصار اختلاف التخصّص **تنبيهاً** لا منعاً، كما في نافذة طلب المجموعة.
 *
 * ويبقى قيدُ «من لا موضوع له ولا طلب قائم»: إسنادُ من له مشروعٌ يردّه
 * الخادم، ومن له طلبٌ حيٌّ يُترك طلبُه معلَّقاً بلا بتّ.
 *
 * وحين لا يُوجد الرقم يُسأل عنه ثانيةً بلا قيدٍ البتّة — لا ليُسنَد، بل
 * ليُقال السبب: أمرتبطٌ بموضوع، أم لا وجود له؟ «لا طالب بهذا الرقم» وحدها
 * لا تُرشد إلى فعلٍ ولا تُصدَّق حين يكون الطالب أمام عينيك.
 *
 * ورقمُ التسجيل هو المفتاح، لكنّ الاسم لم يُفقد: نصٌّ لا يطابق رقماً
 * تُعرض نتائجُه أسفل المقعد لتُنقر، فيملأ النقرُ الرقمَ الصحيح.
 */
export function StudentSeat({
  seat,
  index,
  value,
  onChange,
  onResolve,
  taken,
  specializationId,
  specializationName,
  initial,
  isLeader,
  onMakeLeader,
  disabled,
}: {
  /** رقم المقعد كما يُعرض (يبدأ من ١). */
  seat: number;
  /** موضعه في المصفوفة (يبدأ من ٠). */
  index: number;
  value: string;
  onChange: (index: number, text: string) => void;
  onResolve: (index: number, student: SeatStudent | null) => void;
  /** أرقامُ المقاعد الأخرى — فلا يُسنَد الطالب نفسه مرّتين. */
  taken: string[];
  /** تخصّص الموضوع — للمقارنة لا للتصفية. */
  specializationId: string;
  /** اسمه، ليقوله التنبيه عند الاختلاف. */
  specializationName?: string;
  /**
   * عضوٌ مُسنَدٌ سلفاً يشغل هذا المقعد — في حوار التعديل.
   *
   * ولا يُبحث عنه: البحث مقصورٌ على من لا موضوع له، وهذا له موضوعٌ هو
   * الموضوع الذي نُعدّله. فلو سُئل عنه الخادمُ لردّ لا شيء، ولأفرغ المقعدَ
   * عضواً قائماً بمجرّد فتح النافذة.
   */
  initial?: SeatStudent | null;
  isLeader: boolean;
  onMakeLeader: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const reg = value.trim();
  const debounced = useDebouncedValue(reg, 350);
  const isDupe = reg.length > 0 && taken.includes(reg);
  const seeded = !!initial && !!reg && initial.reg.trim() === reg;
  const term =
    reg.length > 0 && !isDupe && !seeded && debounced === reg ? reg : "";

  // `quickSearch` لا `search`: الأخيرة تبحث في الاسم وحده — فرقمُ تسجيلٍ
  // يُرسَل فيها لا يجد شيئاً أبداً. و`quickSearch` تجرّب الرقم والاسم
  // واسم المستخدم والبريد معاً، وهي التي يستعملها منتقي الطلبة.
  const { data, isFetching } = useStudents(
    {
      page: 1,
      limit: 5,
      quickSearch: term || undefined,
      unassigned: "true",
    },
    !!term,
  );

  const items = (data?.items ?? []) as any[];
  const found = seeded
    ? {
        id: initial!.id,
        registrationNumber: initial!.reg,
        user: initial!.user,
        // العضو المبذور لا يُقارَن تخصّصه: هو في الموضوع أصلاً.
        specializationId: undefined as string | undefined,
      }
    : items.find((s) => (s.registrationNumber ?? "").trim() === term);

  // مِجسُّ السبب: لا يُسأل إلا حين يخيب البحث، وبلا قيدٍ البتّة.
  const missing = !!term && !isFetching && !found && !seeded;
  const { data: probeData, isFetching: probing } = useStudents(
    { page: 1, limit: 1, registrationNumber: term || undefined },
    missing,
  );
  const probed = ((probeData?.items ?? []) as any[]).find(
    (s) => (s.registrationNumber ?? "").trim() === term,
  );

  const status = !reg
    ? "idle"
    : isDupe
      ? "dupe"
      : seeded
        ? "found"
        : !term || isFetching
          ? "loading"
          : found
            ? "found"
            : "notfound";

  /**
   * تخصّصٌ مختلف: تنبيهٌ لا منع — الخادم يقبله، والإدارة هي من يقرّر.
   * وغيابُ أحد الطرفين ليس اختلافاً.
   */
  const mismatch =
    status === "found" &&
    !!specializationId &&
    !!found?.specializationId &&
    found.specializationId !== specializationId;

  // يُبلَّغ الأب بما استقرّ عليه المقعد — ومعرّفُ الطالب وحده في التبعيات:
  // الكائن يُبنى في كل رسمة، فلو دخل التبعيات لدارت الحلقة بلا نهاية.
  const hitId = found?.id ?? null;
  useEffect(() => {
    onResolve(
      index,
      found
        ? {
            id: found.id,
            name: nameOf(found.user) || found.registrationNumber || "",
            reg: found.registrationNumber ?? "",
            user: found.user,
          }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitId, index]);

  const ring = mismatch
    ? "border-gold focus:border-gold focus:ring-gold/25"
    : status === "found"
      ? "border-sage focus:border-sage focus:ring-sage/25"
      : status === "notfound" || status === "dupe"
        ? "border-brick/70 focus:border-brick focus:ring-brick/20"
        : "border-forest/15 focus:border-gold focus:ring-gold/25";

  const seatTone =
    status === "found"
      ? isLeader || mismatch
        ? "border-gold/50 bg-gold/5"
        : "border-sage/45 bg-sage/5"
      : status === "notfound" || status === "dupe"
        ? "border-brick/40 bg-brick/5"
        : "border-forest/12 bg-cream-2";

  return (
    <li
      className={`rounded-2xl border p-3 transition ${seatTone}`}
      data-testid={`seat-${seat}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
            isLeader ? "bg-gold/20 text-gold" : "bg-forest/10 text-forest"
          }`}
        >
          {seat}
        </span>

        <div className="relative flex-1">
          <input
            value={value}
            onChange={(e) => onChange(index, e.target.value)}
            placeholder={t("admin.regNumberPlaceholder")}
            dir="ltr"
            disabled={disabled}
            className={`w-full rounded-xl border-2 bg-cream py-2.5 pe-4 ps-11 text-sm text-forest outline-none transition focus:ring-4 disabled:opacity-50 ${ring}`}
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

        {reg && (
          <button
            type="button"
            onClick={() => onChange(index, "")}
            disabled={disabled}
            aria-label={t("admin.clear")}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-clay transition hover:bg-brick/10 hover:text-brick"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {status !== "idle" && (
        <div className="ps-12 pt-2">
          {status === "loading" && (
            <p className="flex items-center gap-2 text-xs text-clay">
              <Loader2 size={14} className="animate-spin" />
              {t("admin.searching")}
            </p>
          )}

          {status === "found" && found && (
            <div
              className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                isLeader || mismatch
                  ? "border-gold/40 bg-gold/10"
                  : "border-sage/35 bg-sage/10"
              }`}
            >
              <UserAvatar user={found.user} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-forest">
                  {nameOf(found.user) || found.registrationNumber}
                  {isLeader && (
                    <span className="ms-2 rounded-full bg-gold/20 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                      {t("admin.leader")}
                    </span>
                  )}
                </p>
                <p className="truncate text-[11px] text-clay" dir="ltr">
                  {found.registrationNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={onMakeLeader}
                disabled={disabled || isLeader}
                title={t("admin.setLeader")}
                className={`grid size-8 shrink-0 place-items-center rounded-lg transition ${
                  isLeader
                    ? "cursor-default text-gold"
                    : "text-clay hover:bg-forest/5 hover:text-gold"
                }`}
              >
                {isLeader ? <SendHorizontal size={16} /> : <Star size={16} />}
              </button>
            </div>
          )}

          {mismatch && (
            <p className="mt-1.5 flex items-start gap-2 rounded-xl border border-gold/35 bg-gold/5 px-3 py-2 text-[11.5px] font-medium text-forest">
              <TriangleAlert size={14} className="mt-0.5 shrink-0 text-gold" />
              {t("admin.seatSpecMismatch", {
                student: found?.specialization?.name ?? "",
                topic: specializationName ?? "",
              })}
            </p>
          )}

          {status === "dupe" && (
            <p className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/5 px-3 py-2 text-xs font-medium text-brick">
              <UserX size={15} className="shrink-0" />
              {t("admin.duplicateSeat")}
            </p>
          )}

          {status === "notfound" && (
            <>
              {/*
                السببُ لا العَرَض: «لا طالب بهذا الرقم» وحدها لا تُرشد إلى
                فعل، ولا تُصدَّق حين يكون الطالب أمام عينيك. فيُسأل عن الرقم
                بلا قيد، فيُقال أمرتبطٌ هو بموضوع أم لا وجود له.
              */}
              <p className="flex items-center gap-2 rounded-xl border border-brick/30 bg-brick/5 px-3 py-2 text-xs font-medium text-brick">
                <UserX size={15} className="shrink-0" />
                {probing
                  ? t("admin.searching")
                  : probed
                    ? t("admin.studentAlreadyEngaged", {
                        name:
                          nameOf(probed.user) || probed.registrationNumber,
                      })
                    : t("admin.noStudentWithNumber")}
              </p>

              {/* الاسمُ لم يُفقد: ما طابق نصَّك يُنقر فيملأ رقمه. */}
              {items.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-xl border border-forest/10 bg-cream-card">
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChange(index, s.registrationNumber ?? "")}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition hover:bg-forest/5"
                    >
                      <UserAvatar user={s.user} size={30} />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-forest">
                          {nameOf(s.user) || s.registrationNumber}
                        </p>
                        <p className="text-[11px] text-clay" dir="ltr">
                          {s.registrationNumber}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
