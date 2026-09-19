import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  GraduationCap,
  Hash,
  Mail,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { Stepper } from "../../../../../components/ui/stepper";
import { Panel } from "../../form/entity-form";
import { UserAvatar } from "../../../../../components/ui/user-avatar";
import { useDeleteTopic, useDissolveProject } from "../../../hooks/admin-hook";
import { useSendMessage } from "../../../hooks/messages-hook";

type PersonRef = {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
} | null;

export interface GroupMemberRef {
  id: string;
  isLeader?: boolean;
  student?: {
    registrationNumber?: string | null;
    user?: PersonRef;
  } | null;
}

export interface SupervisorRef {
  employeeNumber?: string | null;
  universityEmail?: string | null;
  user?: PersonRef;
}

interface Props {
  onClose: () => void;
  topicId: string;
  topicTitle: string;
  /** مجموعة المشروع القائمة على الموضوع، إن وُجدت. */
  groupId: string | null;
  members: GroupMemberRef[];
  supervisor: SupervisorRef | null;
  /** حساب الأستاذ المشرف — إليه تُرسل الرسالة. */
  supervisorUserId: string | null;
  onDeleted: () => void;
}

const nameOf = (u?: PersonRef) =>
  [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim();

/**
 * حذف موضوعٍ قام عليه مشروع.
 *
 * الخلفية ترفض حذف موضوعٍ تشكّلت له مجموعة — ولها الحقّ: الحذف يمحو مشروع
 * طلبةٍ بلا أن يعلموا. فكان زرّ «حذف» على مثل هذا الموضوع يُردّ برسالة خطأ،
 * بلا طريقٍ إلى الأمام.
 *
 * وهذا المعالج هو الطريق، وثلاث خطواتٍ **كلٌّ منها تقع فور الضغط**، لكلّ
 * طرفٍ خطوته وسببه:
 *
 *   ١. تُحذف المجموعة بسببٍ يصل أعضاءها — وهنا يزول المانع؛
 *   ٢. تُرسَل إلى المشرف رسالةٌ بسببه هو، مستقلّةً عن سبب الطلبة؛
 *   ٣. يُراجَع ما وقع كلّه، ثم يُحذف الموضوع.
 *
 * ولذلك لا رجوع فيه: ما وقع لا يُستردّ، وزرُّ «السابق» بعده يَعِد بما لا
 * يملك. والشريط السفليّ يقول هذا في كل خطوة.
 *
 * ولا يستطيع المعالج فصل الأستاذ عن الموضوع: `professorId` عمودٌ إلزاميّ في
 * المخطّط، فلا وجود لموضوعٍ بلا مشرف. والإشراف ينقطع بحذف الموضوع نفسه —
 * وما قبله إعلامٌ لا فصل، وهو ما تقوله الخطوة الثانية صراحةً بدل أن تُوهم
 * بإزالةٍ لا تقع.
 *
 * ويُركَّب عند الفتح ويُفكَّك عند الإغلاق، فحالته تولد نظيفةً في كل مرّة.
 */
export function TopicDeleteDialog({
  onClose,
  topicId,
  topicTitle,
  groupId,
  members,
  supervisor,
  supervisorUserId,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const dissolve = useDissolveProject();
  const sendMessage = useSendMessage();
  const deleteTopic = useDeleteTopic();

  const [stepIndex, setStepIndex] = useState(0);
  const [studentReason, setStudentReason] = useState("");
  const [professorReason, setProfessorReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [messageSent, setMessageSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // خطوةٌ لكل طرف: من يُحذف على حدة، ومن يُبلَّغ على حدة، ثم المراجعة.
  const steps = [
    ...(groupId ? [{ key: "group", label: t("admin.stepDeleteGroup") }] : []),
    ...(supervisorUserId
      ? [{ key: "supervisor", label: t("admin.stepSupervisor") }]
      : []),
    { key: "review", label: t("admin.stepConfirmDelete") },
  ];
  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index]!;

  const busy =
    dissolve.isPending || sendMessage.isPending || deleteTopic.isPending;

  const supervisorName = nameOf(supervisor?.user) || t("admin.supervisor");

  // القائد أوّلاً: هو مُرسِل الطلب، وقراءة المجموعة تبدأ منه.
  const ordered = [...members].sort(
    (a, b) => Number(!!b.isLeader) - Number(!!a.isLeader),
  );

  const serverMessage = (e: unknown) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? t("admin.actionFailed");

  const advance = () => {
    setTouched(false);
    setStepIndex(index + 1);
  };

  function onDeleteGroup() {
    setTouched(true);
    if (!studentReason.trim() || !groupId) return;
    setError(null);
    dissolve.mutate(
      { groupId, reason: studentReason.trim() },
      {
        onSuccess: () => {
          setDeletedCount(members.length);
          advance();
        },
        // الرفض هنا مشروع: تسليماتٌ أو مناقشةٌ مبرمجة. يُعرض نصّ الخادم كما
        // هو لأنه يقول **ما** يمنع و**أين** يُحذف — ولا تُرسَل بعده رسالةٌ
        // عن حذفٍ لم يقع، لأن خطوة المشرف لم تُبلَغ أصلاً.
        onError: (e) => setError(serverMessage(e)),
      },
    );
  }

  function onNotifySupervisor() {
    setTouched(true);
    if (!professorReason.trim() || !supervisorUserId) return;
    setError(null);
    sendMessage.mutate(
      {
        recipientIds: [supervisorUserId],
        subject: t("admin.deleteTopicSubject", { title: topicTitle }),
        body: professorReason.trim(),
      },
      {
        onSuccess: () => {
          setMessageSent(true);
          advance();
        },
        onError: (e) => setError(serverMessage(e)),
      },
    );
  }

  function onConfirmDelete() {
    setError(null);
    deleteTopic.mutate(topicId, {
      onSuccess: () => onDeleted(),
      onError: (e) => setError(serverMessage(e)),
    });
  }

  const reasonBox = (
    value: string,
    onChange: (v: string) => void,
    label: string,
  ) => {
    const invalid = touched && !value.trim();
    return (
      <label className="block">
        <span
          className={`mb-1 block text-[11px] font-medium ${invalid ? "text-brick" : "text-clay"}`}
        >
          {label} <span className="text-brick">*</span>
        </span>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={t("admin.reasonPlaceholder")}
          className={`w-full resize-none rounded-xl border bg-cream px-3 py-2 text-sm text-forest outline-none transition focus:ring-2 ${
            invalid
              ? "border-brick/50 focus:border-brick focus:ring-brick/20"
              : "border-forest/15 focus:border-sage focus:ring-sage/20"
          }`}
        />
        {invalid && (
          <p className="mt-1 text-[11px] text-brick">
            {t("admin.reasonRequired")}
          </p>
        )}
      </label>
    );
  };

  /** سببٌ كُتب في خطوةٍ ماضية — يُعاد في المراجعة كما كُتب. */
  const quoted = (text: string) => (
    <span className="mt-0.5 block leading-relaxed text-clay">
      «{text.trim()}»
    </span>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-60 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-forest-deep/50 backdrop-blur-sm"
      />

      {/*
        إطارٌ ثابتٌ لا أقصى — كما في معالج إنشاء الحساب: الخطوات الثلاث
        تختلف طولاً (بطاقات ثلاثة طلبة، ثم بطاقةُ مشرفٍ واحدة، ثم مراجعة)،
        فلو تمدّد الإطار بطول محتواه لقفز في كل انتقال وتحرّك زرّ «المتابعة»
        تحت الإصبع. والمحتوى وحده يتمرّر داخله.
      */}
      <div className="animate-[fadeIn_0.15s_ease-out] relative flex h-[min(90vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-forest/10 bg-cream-card shadow-2xl">
        {/* ── الترويسة ── */}
        <header className="relative shrink-0 bg-linear-to-l from-forest to-forest-deep px-6 py-3.5 text-cream">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-500/20 text-red-300 ring-1 ring-red-400/30">
              <Trash2 size={22} />
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="truncate font-serif text-lg font-bold">
                {t("admin.deleteTopicWizard")}
              </h3>
              <p className="flex items-center gap-2 truncate text-[11.5px] text-cream/70">
                <AlertTriangle size={12} className="shrink-0" />
                {topicTitle}
              </p>
            </div>

            <button
              onClick={() => !busy && onClose()}
              aria-label={t("pro.cancel")}
              className="grid size-9 shrink-0 place-items-center rounded-xl text-cream/80 transition hover:bg-cream/15 hover:text-cream"
            >
              <X size={17} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-linear-to-l from-gold to-gold-soft" />
        </header>

        {steps.length > 1 && (
          <div className="shrink-0 border-b border-forest/10 bg-cream-2/40 px-10 py-3">
            {/* بلا `onGo`: ما وقع لا يُراجَع. */}
            <Stepper steps={steps} current={index} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto w-full max-w-3xl space-y-4">
            {step.key === "group" && (
              <Panel title={t("admin.stepDeleteGroup")} icon={UsersRound}>
                <p className="flex items-start gap-2 rounded-xl bg-cream-2 px-3 py-2.5 text-[12px] leading-relaxed text-clay">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-gold" />
                  {t("admin.deleteGroupLead", { count: members.length })}
                </p>

                {/* المجموعة كلّها معروضة: من يُحذف يُرى قبل أن يُحذف. */}
                <ul
                  className="grid gap-2.5 sm:grid-cols-2"
                  data-testid="group-members"
                >
                  {ordered.map((m) => (
                    <li
                      key={m.id}
                      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                        m.isLeader
                          ? "border-gold bg-gold/5 shadow-[0_2px_10px_rgba(197,160,89,0.15)]"
                          : "border-forest/10 bg-cream-2"
                      }`}
                    >
                      <UserAvatar user={m.student?.user} size={42} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-forest">
                          {nameOf(m.student?.user) || "—"}
                          {m.isLeader && (
                            <span className="ms-2 rounded-full bg-gold/15 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                              {t("admin.leader")}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-clay" dir="ltr">
                          {m.student?.registrationNumber ?? ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                {reasonBox(
                  studentReason,
                  setStudentReason,
                  t("admin.reasonForStudents"),
                )}
              </Panel>
            )}

            {step.key === "supervisor" && (
              <Panel title={t("admin.stepSupervisor")} icon={GraduationCap}>
                <div
                  className="flex items-center gap-4 rounded-2xl border border-forest/10 bg-cream-2 p-4"
                  data-testid="supervisor-card"
                >
                  <UserAvatar
                    user={supervisor?.user}
                    size={58}
                    radius="rounded-2xl"
                    className="ring-2 ring-gold/30"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-forest">
                      {supervisorName}
                    </p>
                    <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
                      {supervisor?.universityEmail && (
                        <p
                          className="flex items-center gap-1.5 truncate text-[11.5px] text-clay"
                          dir="ltr"
                        >
                          <Mail size={12} className="shrink-0 text-sage" />
                          {supervisor.universityEmail}
                        </p>
                      )}
                      {supervisor?.employeeNumber && (
                        <p
                          className="flex items-center gap-1.5 truncate text-[11.5px] text-clay"
                          dir="ltr"
                        >
                          <Hash size={12} className="shrink-0 text-sage" />
                          {supervisor.employeeNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* لا تَعِد الخطوة بفصلٍ لا يقع: الإشراف ينقطع بحذف الموضوع. */}
                <p className="flex items-start gap-2 rounded-xl bg-cream-2/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-clay">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-gold" />
                  {t("admin.supervisorLead", { name: supervisorName })}
                </p>

                {reasonBox(
                  professorReason,
                  setProfessorReason,
                  t("admin.reasonForProfessor"),
                )}
              </Panel>
            )}

            {step.key === "review" && (
              <Panel title={t("admin.stepConfirmDelete")} icon={ClipboardCheck}>
                <ul className="space-y-2.5 text-[12.5px]">
                  {deletedCount !== null && (
                    <li className="rounded-2xl border border-sage/25 bg-sage/10 p-3.5">
                      <span className="flex items-center gap-2 font-bold text-forest">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sage/25 text-sage">
                          <Check size={13} />
                        </span>
                        {t("admin.groupDeletedDone", { count: deletedCount })}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5 ps-8">
                        {ordered.map((m) => (
                          <span
                            key={m.id}
                            className="rounded-full bg-cream-card px-2 py-0.5 text-[11px] text-forest"
                          >
                            {nameOf(m.student?.user) ||
                              m.student?.registrationNumber ||
                              "—"}
                          </span>
                        ))}
                      </span>
                      <span className="block ps-8">{quoted(studentReason)}</span>
                    </li>
                  )}

                  {messageSent && (
                    <li className="rounded-2xl border border-sage/25 bg-sage/10 p-3.5">
                      <span className="flex items-center gap-2 font-bold text-forest">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sage/25 text-sage">
                          <Check size={13} />
                        </span>
                        {t("admin.supervisorNotifiedDone", {
                          name: supervisorName,
                        })}
                      </span>
                      <span className="block ps-8">
                        {quoted(professorReason)}
                      </span>
                    </li>
                  )}

                  <li className="flex items-center gap-2 rounded-2xl border border-brick/25 bg-brick/5 p-3.5 font-bold text-forest">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brick/15 text-brick">
                      <Trash2 size={13} />
                    </span>
                    {t("admin.topicWillBeDeleted", { title: topicTitle })}
                  </li>
                </ul>
              </Panel>
            )}

            {error && (
              <p className="rounded-xl border border-brick/30 bg-brick/5 px-3 py-2.5 text-[12px] leading-relaxed text-brick">
                {error}
              </p>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-forest/10 bg-cream-2/60 px-6 py-3.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-clay">
            <AlertTriangle size={13} className="text-gold" />
            {t("admin.irreversibleNow")}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-60"
            >
              {t("pro.cancel")}
            </button>

            {step.key === "group" && (
              <button
                onClick={onDeleteGroup}
                disabled={busy}
                data-testid="group-next"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep shadow-[0_2px_10px_rgba(197,160,89,0.3)] transition hover:bg-gold-soft disabled:opacity-60"
              >
                <UsersRound size={16} />
                {t("admin.deleteGroupAndContinue")}
              </button>
            )}

            {step.key === "supervisor" && (
              <button
                onClick={onNotifySupervisor}
                disabled={busy}
                data-testid="supervisor-next"
                className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep shadow-[0_2px_10px_rgba(197,160,89,0.3)] transition hover:bg-gold-soft disabled:opacity-60"
              >
                <Mail size={16} />
                {t("admin.sendReasonAndContinue")}
              </button>
            )}

            {step.key === "review" && (
              <button
                onClick={onConfirmDelete}
                disabled={busy}
                data-testid="confirm-delete"
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(239,68,68,0.3)] transition hover:bg-red-600 disabled:opacity-60"
              >
                <Trash2 size={16} />
                {t("admin.confirmDeleteNow")}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
