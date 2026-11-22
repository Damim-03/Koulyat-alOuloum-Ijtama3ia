import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Hourglass,
  Loader2,
  Lock,
  RotateCcw,
  ScanLine,
  Send,
  XCircle,
} from "lucide-react";
import { useAuthStore } from "../../../store/auth.store";
import { useDates } from "../../../hooks/use-dates";
import { serverMessage } from "../../../lib/api/error";
import { cardQrVerdict, readRegistration } from "../../../lib/read-registration";
import { LoadingArea } from "../../../components/ui/loading-area";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { PhotoCapture, type CapturedPhoto } from "../../../components/camera/photo-capture";
import { useMyAccount, useMyActivationRequest, useSendActivationRequest } from "../account.api";

/**
 * توثيق الحساب بصورة البطاقة (Backend modules/activation): يصوّر الطالب بطاقته
 * ويرسل؛ فتتحقّق الإدارة أنّها بطاقته — اسمه ورقمه — فيظهر الحساب «موثّقاً».
 * فإن رُفض الطلب قيل له السبب فأعاد الإرسال. البطاقة وحدها (قرار المستخدم،
 * 2026-11-18): كانت البطاقة ثمّ الوجه معها.
 *
 * يظهر في موضعين:
 *  - **المرحلة الثانية من التفعيل** (`VerificationStep`) — بعد أن يختار
 *    الطالب كلمة مروره في أوّل دخول، وله أن يتخطّاها فيدخل حسابه غير موثّق؛
 *  - **«توثيق الحساب» في «حسابي»** (`VerificationWing`) — متى شاء بعد ذلك.
 */

/**
 * The second stage of a student's first sign-in: the photos — or «skip», and
 * the account as it is. Either way the review comes next (`skipped` says which).
 */
export function VerificationStep({ onDone }: { onDone: (skipped: boolean) => void }) {
  const { t } = useTranslation();
  const account = useMyAccount();
  const request = useMyActivationRequest();
  if (account.isLoading || request.isLoading) return <LoadingArea className="py-16" />;
  // Verified already (a password reset by the administration, say): nothing to send.
  if (account.data?.isVerified) {
    return (
      <>
        <Verified />
        <Finish onFinish={() => onDone(false)} label={t("account.gate.activation.continue")} />
      </>
    );
  }
  const sent = request.data?.status === "pending";
  return (
    <>
      <RequestFlow />
      <Finish
        onFinish={() => onDone(!sent)}
        label={t(sent ? "account.gate.activation.continue" : "account.gate.activation.skip")}
        hint={sent ? undefined : t("account.gate.activation.skipHint")}
        testId={sent ? "activation-continue" : "activation-skip"}
      />
    </>
  );
}

/** «توثيق الحساب» in the account: for any student not verified yet. */
export function VerificationWing({ verified }: { verified: boolean }) {
  return verified ? <Verified /> : <RequestFlow intro />;
}

function Verified() {
  const { t } = useTranslation();
  return (
    <div className="py-6 text-center" data-testid="verification-done">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 ring-8 ring-emerald-500/5 dark:text-emerald-300">
        <BadgeCheck size={30} />
      </span>
      <h2 className="mt-4 font-serif text-[20px] font-bold text-forest">{t("activation.verification.doneTitle")}</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-clay">{t("activation.verification.doneBody")}</p>
    </div>
  );
}

function Finish({ onFinish, label, hint, testId = "activation-continue" }: { onFinish: () => void; label: string; hint?: string; testId?: string }) {
  return (
    <div className="mt-6 border-t border-forest/8 pt-5 text-center">
      <button
        type="button"
        onClick={onFinish}
        data-testid={testId}
        className="inline-flex items-center gap-2 rounded-xl border border-forest/15 bg-cream-card px-5 py-2.5 text-[13px] font-bold text-forest transition hover:border-gold/45 hover:bg-gold/8"
      >
        {label}
        <ArrowLeft size={15} className="text-gold ltr:rotate-180" />
      </button>
      {hint && <p className="mx-auto mt-2 max-w-md text-[11.5px] leading-relaxed text-clay">{hint}</p>}
    </div>
  );
}

function RequestFlow({ intro }: { intro?: boolean }) {
  const { t } = useTranslation();
  const q = useMyActivationRequest();
  // «Send again» from the waiting state, over what the request's state shows by default.
  const [again, setAgain] = useState(false);

  if (q.isLoading) return <LoadingArea className="py-16" />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => q.refetch()} />;

  const request = q.data;
  if (request.status === "pending" && !again) {
    return <Pending sentAt={request.sentAt} onResend={() => setAgain(true)} />;
  }

  return (
    <>
      {intro && request.status === "none" && (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/8 px-3 py-2.5 text-[12.5px] leading-relaxed text-forest/85">
          <BadgeCheck size={16} className="mt-0.5 shrink-0 text-gold" />
          {t("activation.verification.intro")}
        </p>
      )}
      {request.status === "rejected" && (
        <div role="alert" data-testid="activation-rejected" className="mb-5 rounded-2xl border border-brick/25 bg-brick/8 p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-bold text-brick">
            <XCircle size={17} />
            {t("activation.rejected.title")}
          </p>
          {request.reason && <p className="mt-1.5 text-[12.5px] leading-relaxed text-forest/85">{request.reason}</p>}
          <p className="mt-1.5 text-[12px] text-clay">{t("activation.rejected.again")}</p>
        </div>
      )}
      <RequestForm onSent={() => setAgain(false)} />
    </>
  );
}

function Pending({ sentAt, onResend }: { sentAt: string; onResend: () => void }) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  return (
    <div className="py-4 text-center" data-testid="activation-pending">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-gold/12 text-gold ring-8 ring-gold/5">
        <Hourglass size={28} />
      </span>
      <h2 className="mt-4 font-serif text-[20px] font-bold text-forest">{t("activation.pending.title")}</h2>
      <p className="mt-1 text-[12px] text-clay">{t("activation.pending.sent", { time: fmtDate(sentAt, true) })}</p>
      <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-forest/85">{t("activation.verification.pendingBody")}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onResend}
          className="inline-flex items-center gap-1.5 rounded-xl border border-forest/15 bg-cream-card px-4 py-2 text-[12.5px] font-bold text-forest transition hover:border-gold/45"
        >
          <RotateCcw size={14} className="text-gold" />
          {t("activation.pending.resend")}
        </button>
      </div>
    </div>
  );
}

/** The card — and send. */
function RequestForm({ onSent }: { onSent: () => void }) {
  const { t } = useTranslation();
  const reg = useAuthStore((s) => s.user?.registrationNumber ?? "");
  const send = useSendActivationRequest();
  const [card, setCard] = useState<CapturedPhoto | null>(null);
  const read = card?.qr ? readRegistration(card.qr) : null;
  // Only the account's own card is sent: its code read, and its number the account's.
  const ready = !!card && read === reg;

  return (
    <form
      noValidate
      data-testid="activation-request-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!card || send.isPending) return;
        send.mutate(
          { card: card.blob, qrNumber: read },
          {
            onSuccess: () => {
              toast.success(t("activation.verification.sent"));
              onSent();
            },
          },
        );
      }}
    >
      <section className="mb-5">
        <h3 className="mb-2.5 text-[13.5px] font-bold text-forest">{t("activation.photo.card.title")}</h3>
        <PhotoCapture kind="card" photo={card} onPhoto={setCard} judgeQr={(text) => cardQrVerdict(text, reg)} />
        {card && (
          <p
            data-testid="activation-qr"
            data-verdict={read === reg ? "match" : read ? "other" : "unread"}
            role={read === reg ? "status" : "alert"}
            className={`mt-2 flex items-start gap-1.5 rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
              read === reg
                ? "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                : "bg-brick/8 text-brick ring-1 ring-brick/20"
            }`}
          >
            {read === reg ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            ) : !read ? (
              <ScanLine size={14} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            )}
            {t(!read ? "activation.qr.unread" : read === reg ? "activation.qr.match" : "activation.qr.other")}
          </p>
        )}
      </section>

      <p className="mb-4 flex items-start gap-2 rounded-xl bg-forest/5 px-3 py-2.5 text-[12px] leading-relaxed text-forest/80">
        <Lock size={14} className="mt-0.5 shrink-0 text-gold" />
        {t("activation.verification.privacy")}
      </p>

      {send.isError && (
        <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl bg-brick/8 px-3 py-2.5 text-[12.5px] leading-relaxed text-brick ring-1 ring-brick/20">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {serverMessage(send.error, t("apiError.unexpected"))}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || send.isPending}
        title={card && !ready ? t("activation.qr.blocked") : undefined}
        data-testid="activation-send"
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-br from-forest-soft to-forest p-3 text-[14.5px] font-bold text-cream shadow-[0_10px_24px_rgba(38,66,61,0.30)] ring-1 ring-inset ring-gold/15 transition hover:-translate-y-px disabled:translate-y-0 disabled:cursor-default disabled:opacity-60"
      >
        {send.isPending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} className="rtl:-scale-x-100" />}
        {t("activation.verification.send")}
      </button>
    </form>
  );
}

