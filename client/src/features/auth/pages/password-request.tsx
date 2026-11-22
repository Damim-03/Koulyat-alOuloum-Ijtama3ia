import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Hash,
  Hourglass,
  IdCard,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  RotateCcw,
  ScanLine,
  Send,
  ShieldAlert,
  TimerOff,
  Undo2,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { useDates } from "../../../hooks/use-dates";
import { PATHS } from "../../../routes/paths";
import { serverMessage } from "../../../lib/api/error";
import { readRegistration, cardQrVerdict } from "../../../lib/read-registration";
import { PhotoCapture, type CapturedPhoto } from "../../../components/camera/photo-capture";
import { authApi, type PasswordRequestState } from "../api/auth.api";
import { Notice, Shell, primaryBtn } from "../components/recover-shell";

/**
 * «نسيت كلمة المرور» for a student whose account has no confirmed address
 * (Backend modules/password-request): the card's photo to the administration,
 * the wait, and the password an administrator wrote — copied, and on to the
 * sign-in page, where it is pasted and replaced by one of their own.
 *
 * The request is followed by this browser alone: the secret the server
 * answered with is kept here (localStorage), so the page closed and opened
 * again — on this device — finds it where it was.
 */

/** What the page is after, the request it sent, held by this browser. */
export interface StoredRequest {
  token: string;
  registrationNumber: string;
}

const STORE = "recover.passwordRequest";

function readStored(): StoredRequest | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null") as Partial<StoredRequest> | null;
    return v && typeof v.token === "string" && typeof v.registrationNumber === "string"
      ? { token: v.token, registrationNumber: v.registrationNumber }
      : null;
  } catch {
    return null;
  }
}

/** The request this browser sent, if any — kept across visits. */
export function useStoredRequest() {
  const [value, setValue] = useState<StoredRequest | null>(readStored);
  const save = (r: StoredRequest) => {
    try {
      localStorage.setItem(STORE, JSON.stringify(r));
    } catch {
      /* private window: followed for this visit only */
    }
    setValue(r);
  };
  const clear = () => {
    try {
      localStorage.removeItem(STORE);
    } catch {
      /* nothing kept */
    }
    setValue(null);
  };
  return { value, save, clear };
}

/**
 * Puts the text on the clipboard: the browser's own way where the page is
 * secure, else the old one — the university's server may be plain HTTP,
 * where the first does not exist.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* refused: try the other way */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = typeof document.execCommand === "function" && document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/* ── The card ─────────────────────────────────────────────── */

export function AdminRequestForm({
  registrationNumber,
  onBack,
  onSent,
}: {
  registrationNumber: string;
  onBack: () => void;
  onSent: (r: StoredRequest) => void;
}) {
  const { t } = useTranslation();
  const [card, setCard] = useState<CapturedPhoto | null>(null);
  const read = card?.qr ? readRegistration(card.qr) : null;
  // Only the card of this number goes: its code read, and the number the one typed.
  const ready = !!card && read === registrationNumber;
  const send = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("registrationNumber", registrationNumber);
      if (read) form.append("qrNumber", read);
      form.append("card", card!.blob, "card.jpg");
      return authApi.sendPasswordRequest(form);
    },
    onSuccess: (r) => onSent({ token: r.token, registrationNumber }),
  });

  return (
    <Shell icon={IdCard} title={t("auth.recover.admin.title")} subtitle={t("auth.recover.admin.subtitle")} step={0} road="admin" wide>
      {/* One column on a phone. From a tablet's width, the number across the top, then two columns:
          the photo of the card at the end, and at the start what it says of the card above, the
          button below — level with the photo's foot. */}
      <form
        noValidate
        data-testid="recover-request-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !send.isPending) send.mutate();
        }}
        className="space-y-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:grid-rows-[auto_auto_auto_1fr_auto_auto] md:gap-x-7 md:gap-y-4 md:space-y-0"
      >
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-forest/10 bg-cream-2 px-4 py-2.5 md:col-span-2 md:row-start-1">
          <span className="flex min-w-0 items-center gap-2.5">
            <Hash size={16} className="shrink-0 text-gold" />
            {/* On a phone the sign # says it: the whole number keeps the room. */}
            <span className="text-[12px] font-semibold text-clay max-sm:sr-only">{t("pro.regNumber")}</span>
            <bdi dir="ltr" data-testid="recover-request-number" className="shrink-0 font-mono text-[14px] font-bold tracking-wide text-forest">
              {registrationNumber}
            </bdi>
          </span>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-gold transition hover:bg-gold/10"
          >
            <Undo2 size={13} />
            <span className="max-[359px]:sr-only">{t("auth.recover.admin.change")}</span>
          </button>
        </div>

        <div className="md:col-start-2 md:row-[2/-1] md:self-start">
          <PhotoCapture kind="card" photo={card} onPhoto={setCard} judgeQr={(text) => cardQrVerdict(text, registrationNumber)} />
        </div>
        {card && (
          <p
            data-testid="recover-request-qr"
            data-verdict={read === registrationNumber ? "match" : read ? "other" : "unread"}
            role={read === registrationNumber ? "status" : "alert"}
            className={`flex items-start gap-1.5 rounded-xl px-3 py-2 text-[12px] leading-relaxed md:col-start-1 md:row-start-2 md:self-start ${
              read === registrationNumber
                ? "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                : "bg-brick/8 text-brick ring-1 ring-brick/20"
            }`}
          >
            {read === registrationNumber ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            ) : !read ? (
              <ScanLine size={14} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            )}
            {t(!read ? "activation.qr.unread" : read === registrationNumber ? "auth.recover.admin.qrMatch" : "auth.recover.admin.qrOther")}
          </p>
        )}

        {send.isError && (
          <div className="md:col-start-1 md:row-start-3 md:self-start">
            <Notice tone="error">{serverMessage(send.error, t("auth.recover.failed"))}</Notice>
          </div>
        )}

        <button
          type="submit"
          disabled={!ready || send.isPending}
          data-testid="recover-request-send"
          className={`${primaryBtn} md:col-start-1 md:row-start-5`}
        >
          {send.isPending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} className="rtl:-scale-x-100" />}
          {t("auth.recover.admin.send")}
        </button>

        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-clay md:col-start-1 md:row-start-6">
          <Lock size={14} className="mt-0.5 shrink-0 text-sage" />
          <span>{t("auth.recover.admin.privacy")}</span>
        </p>
      </form>
    </Shell>
  );
}

/* ── The wait, and the answer ─────────────────────────────── */

/** Asked again this often while the administration has not answered. */
const POLL_MS = 10_000;

export function PasswordRequestTracker({
  request,
  onClose,
  onAgain,
}: {
  request: StoredRequest;
  /** The request is over for this browser: back to the form. */
  onClose: () => void;
  /** Refused: straight to a new photo of the card, the number already known. */
  onAgain: (registrationNumber: string) => void;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["auth", "password-request", request.token],
    queryFn: () => authApi.passwordRequestStatus(request.token),
    refetchInterval: (query) => (query.state.data?.status === "pending" ? POLL_MS : false),
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const close = useMutation({ mutationFn: () => authApi.closePasswordRequest(request.token) });
  const state: PasswordRequestState | undefined = q.data;

  if (!state)
    return (
      <Shell icon={Hourglass} title={t("auth.recover.wait.title")} step={1} road="admin">
        {q.isError ? (
          <>
            <Notice tone="error">{serverMessage(q.error, t("auth.recover.failed"))}</Notice>
            <button type="button" onClick={() => q.refetch()} className={`${primaryBtn} mt-5`}>
              <RotateCcw size={16} />
              {t("auth.recover.wait.retry")}
            </button>
          </>
        ) : (
          <div className="grid place-items-center py-6">
            <Loader2 size={24} className="animate-spin text-gold" />
          </div>
        )}
      </Shell>
    );

  if (state.status === "approved")
    return <Approved password={state.password} registrationNumber={state.registrationNumber ?? request.registrationNumber} token={request.token} onClose={onClose} />;

  if (state.status === "rejected")
    return (
      <Shell icon={ShieldAlert} tone="warn" title={t("auth.recover.rejected.title")} step={1} road="admin">
        <div role="alert" data-testid="recover-request-rejected" className="rounded-2xl border border-brick/25 bg-brick/[0.06] p-4">
          <p className="text-[12px] font-semibold text-brick">{t("auth.recover.rejected.reason")}</p>
          {state.reason && <p className="mt-1.5 text-[13px] leading-relaxed text-forest/90" dir="auto">{state.reason}</p>}
        </div>
        <button
          type="button"
          disabled={close.isPending}
          onClick={() => close.mutate(undefined, { onSettled: () => onAgain(request.registrationNumber) })}
          data-testid="recover-request-again"
          className={`${primaryBtn} mt-5`}
        >
          <RotateCcw size={16} />
          {t("auth.recover.rejected.again")}
        </button>
      </Shell>
    );

  if (state.status === "none")
    return (
      <Shell icon={TimerOff} tone="warn" title={t("auth.recover.gone.title")}>
        <Notice tone="error" testId="recover-request-gone">{t("auth.recover.gone.body")}</Notice>
        <button type="button" onClick={onClose} className={`${primaryBtn} mt-5`}>
          <RotateCcw size={16} />
          {t("auth.recover.gone.again")}
        </button>
      </Shell>
    );

  return <Waiting sentAt={state.sentAt} registrationNumber={request.registrationNumber} checking={q.isFetching} cancelling={close.isPending} onCancel={() => close.mutate(undefined, { onSettled: onClose })} />;
}

function Waiting({
  sentAt,
  registrationNumber,
  checking,
  cancelling,
  onCancel,
}: {
  sentAt: string;
  registrationNumber: string;
  checking: boolean;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  return (
    <Shell icon={Hourglass} title={t("auth.recover.wait.title")} subtitle={t("auth.recover.wait.body")} step={1} road="admin">
      <div data-testid="recover-request-pending" className="space-y-4">
        <dl className="divide-y divide-forest/8 overflow-hidden rounded-2xl border border-forest/10 bg-cream-2">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-[12px] font-semibold text-clay">{t("pro.regNumber")}</dt>
            <dd className="m-0">
              <bdi dir="ltr" className="font-mono text-[14px] font-bold tracking-wide text-forest">{registrationNumber}</bdi>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-[12px] font-semibold text-clay">{t("auth.recover.wait.sent")}</dt>
            <dd className="m-0 text-[12.5px] font-semibold text-forest">{fmtDate(sentAt, true)}</dd>
          </div>
        </dl>

        <p className="flex items-center justify-center gap-2.5 text-[12px] font-medium text-clay" aria-live="polite">
          <span className="relative grid size-2.5 place-items-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-gold/60" />
            <span className="relative size-2.5 rounded-full bg-gold" />
          </span>
          {t(checking ? "auth.recover.wait.checkingNow" : "auth.recover.wait.checking")}
        </p>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            data-testid="recover-request-cancel"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold text-clay transition hover:bg-brick/8 hover:text-brick disabled:opacity-60"
          >
            {cancelling ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
            {t("auth.recover.wait.cancel")}
          </button>
        </div>
      </div>
    </Shell>
  );
}

/**
 * The password the administration wrote: copied with one button, and the
 * page closes on the sign-in page — the number filled in, and what to do with
 * what was copied. The request goes with it: this browser cannot read it again.
 */
function Approved({
  password,
  registrationNumber,
  token,
  onClose,
}: {
  password: string;
  registrationNumber: string;
  token: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { localePath } = useLanguage();
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    setLeaving(true);
    try {
      await authApi.closePasswordRequest(token);
    } catch {
      /* it goes by itself after a while */
    }
    navigate(localePath(PATHS.login), { replace: true, state: { recovered: { registrationNumber } } });
    onClose();
  };
  const copy = async () => {
    if (await copyText(password)) await leave();
    else setFailed(true);
  };

  return (
    <Shell icon={KeyRound} tone="ok" title={t("auth.recover.approved.title")} subtitle={t("auth.recover.approved.body")} step={2} road="admin">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-gold/45 bg-cream-2 px-4 py-4 text-center shadow-[inset_0_1px_3px_rgba(26,49,45,0.08)]">
          <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-gold to-transparent" />
          <bdi
            dir="ltr"
            data-testid="recover-password"
            className="block select-all break-all font-mono text-[21px] font-bold tracking-[0.08em] text-forest"
          >
            {password}
          </bdi>
        </div>

        {failed && <Notice tone="error" testId="recover-copy-failed">{t("auth.recover.approved.copyFailed")}</Notice>}

        <button type="button" onClick={() => void copy()} disabled={leaving} data-testid="recover-copy" className={primaryBtn}>
          {leaving ? <Loader2 size={17} className="animate-spin" /> : <Clipboard size={17} />}
          {t("auth.recover.approved.copy")}
        </button>
        {failed && (
          <button
            type="button"
            onClick={() => void leave()}
            disabled={leaving}
            data-testid="recover-copied"
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-forest/15 bg-cream-card py-3 text-[13.5px] font-bold text-forest transition hover:border-gold/45"
          >
            <LogIn size={16} className="rtl:rotate-180" />
            {t("auth.recover.approved.continue")}
          </button>
        )}

        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-clay">
          <Lock size={14} className="mt-0.5 shrink-0 text-sage" />
          <span>{t("auth.recover.approved.temporary")}</span>
        </p>
      </div>
    </Shell>
  );
}
