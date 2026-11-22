import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Loader2,
  LogIn,
  MailCheck,
  MailQuestion,
  RotateCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";
import { PATHS } from "../../../routes/paths";
import { ROLES } from "../../../config/roles.config";
import { serverMessage } from "../../../lib/api/error";
import { readRegistration } from "../../../lib/read-registration";
import { cn } from "../../../lib/utils";
import { authApi, type StudentLookup } from "../api/auth.api";
import { Notice, Shell, inputCls, primaryBtn } from "../components/recover-shell";
import { AdminRequestForm, PasswordRequestTracker, useStoredRequest } from "./password-request";
import { PasswordChecklist } from "../../account/components/password-form";
import { passwordIssue, passwordIssueText } from "../../account/lib/password-rules";

/**
 * The pages a link in an email opens — and the one that sends it:
 *
 *   /forgot-password   a registration number (student) or a university email
 *                      (professor), picked with a toggle. A student's number
 *                      is looked up as it is typed (a student's or not —
 *                      never whose); with a confirmed address a link is sent
 *                      (Backend modules/auth/email-links), without one the
 *                      request goes to the administration with the card's
 *                      photo (./password-request). `?as=professor` opens it
 *                      on the professor's side — the sign-in page sends it
 *                      from that tab.
 *   /reset-password    the link's page: a new password, under the same rules
 *                      as any password chosen on the site
 *   /verify-email      the link that proves an address: opened, it is done
 *
 * The token is taken from the address bar and removed from it at once: it
 * should not stay in the history, nor be copied along with the page's link.
 */

const KEY = ["auth", "email-links"] as const;

/** The token of the link, read once; the address bar is cleared of it. */
function useLinkToken() {
  const [params, setParams] = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  useEffect(() => {
    if (params.has("token")) setParams({}, { replace: true });
  }, [params, setParams]);
  return token;
}


/* ── /forgot-password ─────────────────────────────────────── */

type RecoverRole = "student" | "professor";
const RECOVER_ROLES: RecoverRole[] = ["student", "professor"];

/** How each side is found: a student by registration number, a professor by university email. */
const RECOVER_FIELD: Record<RecoverRole, { viaKey: string; subtitleKey: string; placeholder: string; inputMode: "numeric" | "email" }> = {
  student: {
    viaKey: "auth.recover.viaRegNumber",
    subtitleKey: "auth.recover.subtitleStudent",
    placeholder: "202039012345",
    inputMode: "numeric",
  },
  professor: {
    viaKey: "auth.recover.viaUniversityEmail",
    subtitleKey: "auth.recover.subtitleProfessor",
    placeholder: "name@univ-eloued.dz",
    inputMode: "email",
  },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function RecoverRoleToggle({ value, onChange }: { value: RecoverRole; onChange: (r: RecoverRole) => void }) {
  const { t } = useTranslation();
  const refs = useRef<Partial<Record<RecoverRole, HTMLButtonElement | null>>>({});
  // A radio group: the arrows move between the two sides.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = value === "student" ? "professor" : "student";
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={t("auth.recover.accountType")}
      onKeyDown={onKeyDown}
      className="relative grid grid-cols-2 rounded-2xl border border-forest/10 bg-cream-2 p-1 shadow-[inset_0_1px_3px_rgba(26,49,45,0.08)]"
    >
      {/* المؤشّر المنزلق: سطحٌ مرتفع بحافّةٍ ذهبيّة ينتقل إلى الجهة المختارة */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 start-1 w-[calc(50%-0.25rem)] rounded-xl bg-cream-card shadow-[0_8px_20px_-8px_rgba(26,49,45,0.35)] ring-1 ring-gold/45 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          value === "professor" && "ltr:translate-x-full rtl:-translate-x-full",
        )}
      />
      {RECOVER_ROLES.map((key) => {
        const { labelKey, Icon } = ROLES[key];
        const active = value === key;
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[key] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-testid={`recover-as-${key}`}
            onClick={() => onChange(key)}
            className={cn(
              "relative z-10 flex min-w-0 cursor-pointer items-center justify-center gap-2.5 rounded-xl px-2 py-2.5 transition-colors",
              active ? "text-forest" : "text-clay hover:text-forest",
            )}
          >
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full transition-colors",
                active ? "bg-gold/15 text-gold" : "bg-forest/5",
              )}
            >
              <Icon size={16} />
            </span>
            <span className="min-w-0 text-start leading-tight">
              <span className={cn("block text-[13.5px]", active ? "font-bold" : "font-semibold")}>{t(labelKey)}</span>
              <span className="mt-0.5 block truncate text-[10.5px] font-medium text-clay">{t(RECOVER_FIELD[key].viaKey)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A registration number, typed: digits (Arabic-Indic too), maybe spaced — or nothing usable yet. */
const regOf = (typed: string) => (/^[\d\s.\-٠-٩۰-۹]+$/.test(typed.trim()) ? readRegistration(typed) : null);

const lookupKey = (reg: string) => ["auth", "student-lookup", reg] as const;

/**
 * /forgot-password: the form — or, for a student whose account has no
 * confirmed address, the request to the administration this browser sent
 * (./password-request): its card, its wait, its answer.
 */
export function ForgotPasswordPage() {
  const request = useStoredRequest();
  // The card's step, for this number; and the number to start from on coming back.
  const [card, setCard] = useState<string | null>(null);
  const [lastReg, setLastReg] = useState("");

  if (request.value)
    return (
      <PasswordRequestTracker
        request={request.value}
        onClose={request.clear}
        onAgain={(reg) => {
          request.clear();
          setCard(reg);
        }}
      />
    );
  if (card)
    return (
      <AdminRequestForm
        registrationNumber={card}
        onBack={() => {
          setLastReg(card);
          setCard(null);
        }}
        onSent={(r) => {
          request.save(r);
          setCard(null);
        }}
      />
    );
  return (
    <ForgotForm
      initialStudent={lastReg}
      onAskAdmin={(reg) => {
        setLastReg(reg);
        setCard(reg);
      }}
    />
  );
}

function ForgotForm({ initialStudent, onAskAdmin }: { initialStudent: string; onAskAdmin: (registrationNumber: string) => void }) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [role, setRole] = useState<RecoverRole>(() => (params.get("as") === "professor" ? "professor" : "student"));
  // Each side keeps what was typed in it: a number has no place in the email field.
  const [values, setValues] = useState<Record<RecoverRole, string>>({ student: initialStudent, professor: "" });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Mail on this server: the professors' only road, and the students' with a confirmed address.
  const available = useQuery({ queryKey: [...KEY, "available"], queryFn: authApi.resetAvailable, staleTime: 5 * 60_000 });
  const send = useMutation({ mutationFn: (id: string) => authApi.forgotPassword(id) });

  const identifier = values[role].trim();
  const field = RECOVER_FIELD[role];
  const FieldIcon = ROLES[role].FieldIcon;

  // A student's number, looked up once the typing pauses: whether it is a student's, and which road.
  const reg = role === "student" ? regOf(values.student) : null;
  const [settled, setSettled] = useState<string | null>(reg);
  useEffect(() => {
    const id = setTimeout(() => setSettled(reg), 450);
    return () => clearTimeout(id);
  }, [reg]);
  const lookup = useQuery({
    queryKey: lookupKey(settled ?? ""),
    queryFn: () => authApi.lookupStudent(settled!),
    enabled: !!settled && settled === reg,
    staleTime: 60_000,
    retry: false,
  });
  const found = reg && settled === reg ? lookup.data : undefined;
  const lookingUp = !!reg && (settled !== reg || lookup.isFetching);
  // Not answered (the network, too many lookups): said so — the button still asks again.
  const lookupError = !!reg && settled === reg && !lookingUp && lookup.isError ? serverMessage(lookup.error, t("auth.recover.failed")) : null;
  const viaAdmin = found?.found === true && found.via === "admin";
  const blocked = found?.found === true && found.via === "blocked";
  const professorOff = role === "professor" && available.data === false;

  const switchRole = (next: RecoverRole) => {
    if (next === role) return;
    setRole(next);
    setFieldError(null);
    send.reset();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submitStudent = async () => {
    if (!reg) {
      setFieldError(t("auth.recover.lookup.invalid"));
      inputRef.current?.focus();
      return;
    }
    setChecking(true);
    try {
      const r = await qc.fetchQuery({ queryKey: lookupKey(reg), queryFn: () => authApi.lookupStudent(reg), staleTime: 60_000 });
      if (!r.found) setFieldError(t("auth.recover.lookup.missing"));
      else if (r.via === "email") send.mutate(reg);
      else if (r.via === "admin") onAskAdmin(reg);
    } catch (error) {
      setFieldError(serverMessage(error, t("auth.recover.failed")));
    } finally {
      setChecking(false);
    }
  };

  if (send.isSuccess)
    return (
      <Shell icon={MailCheck} tone="ok" title={t("auth.recover.sentTitle")} step={1}>
        <Notice tone="ok" testId="recover-sent">{send.data.message}</Notice>
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => send.mutate(reg ?? identifier)}
            disabled={send.isPending}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-gold transition hover:bg-gold/10 hover:text-gold-soft disabled:cursor-default disabled:opacity-60"
          >
            <RotateCw size={13} className={send.isPending ? "animate-spin" : ""} />
            {t("auth.recover.again")}
          </button>
        </div>
      </Shell>
    );

  const busy = send.isPending || checking;

  return (
    <Shell icon={MailQuestion} title={t("auth.recover.title")} subtitle={t(field.subtitleKey)} step={0} road={viaAdmin ? "admin" : "email"}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || blocked) return;
          if (!identifier) {
            inputRef.current?.focus();
            return;
          }
          if (role === "student") {
            void submitStudent();
            return;
          }
          if (!EMAIL.test(identifier)) {
            setFieldError(t("validation.emailInvalid"));
            inputRef.current?.focus();
            return;
          }
          send.mutate(identifier);
        }}
        className="space-y-5"
      >
        <RecoverRoleToggle value={role} onChange={switchRole} />

        {professorOff ? (
          <Notice tone="error" testId="recover-off">{t("auth.recover.mailOff")}</Notice>
        ) : (
          <>
            <div>
              <label htmlFor="recover-identifier" className="mb-2 block text-[12.5px] font-semibold text-forest/80">
                {t(ROLES[role].fieldLabelKey)}
              </label>
              <div
                className={cn(
                  "group flex h-13 items-center gap-3 rounded-2xl border bg-cream-2 px-4 transition focus-within:bg-cream-card focus-within:ring-4",
                  fieldError || found?.found === false || blocked
                    ? "border-brick/60 focus-within:ring-brick/12"
                    : found?.found
                      ? "border-emerald-500/50 focus-within:ring-emerald-500/12"
                      : "border-forest/15 focus-within:border-gold/70 focus-within:ring-gold/15",
                )}
              >
                <FieldIcon size={18} className="shrink-0 text-clay transition-colors group-focus-within:text-gold" />
                <input
                  id="recover-identifier"
                  key={role}
                  ref={inputRef}
                  value={values[role]}
                  onChange={(e) => {
                    const v = e.target.value;
                    setValues((s) => ({ ...s, [role]: v }));
                    if (fieldError) setFieldError(null);
                  }}
                  autoFocus
                  type={role === "professor" ? "email" : "text"}
                  inputMode={field.inputMode}
                  autoComplete="username"
                  // Numbers and addresses read left to right; the text still sits on the page's side.
                  dir="ltr"
                  style={{ textAlign: isRTL ? "right" : "left" }}
                  maxLength={191}
                  placeholder={field.placeholder}
                  aria-invalid={!!fieldError || found?.found === false}
                  aria-describedby={role === "student" ? "recover-lookup" : undefined}
                  data-testid="recover-identifier"
                  className="h-full min-w-0 flex-1 bg-transparent text-[15px] tracking-wide text-forest outline-none placeholder:text-clay/45"
                />
                {role === "student" && lookingUp && <Loader2 size={16} className="shrink-0 animate-spin text-gold" />}
                {role === "student" && !lookingUp && found?.found && !blocked && (
                  <CheckCircle2 size={17} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              {fieldError ? (
                <p className="mt-1.5 text-[11.5px] text-brick">{fieldError}</p>
              ) : (
                role === "student" && <LookupLine id="recover-lookup" reg={reg} checking={lookingUp} found={found} error={lookupError} />
              )}
            </div>

            {send.isError && <Notice tone="error">{serverMessage(send.error, t("auth.recover.failed"))}</Notice>}

            <button type="submit" disabled={busy || blocked} data-testid="recover-send" className={primaryBtn}>
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : viaAdmin ? (
                <IdCard size={17} />
              ) : (
                <Send size={16} className="rtl:-scale-x-100" />
              )}
              {t(viaAdmin ? "auth.recover.askAdmin" : "auth.recover.send")}
            </button>

            <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-clay">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-sage" />
              <span>{t(role === "student" ? "auth.recover.studentNote" : "auth.recover.onlyConfirmed")}</span>
            </p>
          </>
        )}
      </form>
    </Shell>
  );
}

/** Under the student's number: looking it up, then whether it is a student's — and which road comes next. */
function LookupLine({
  id,
  reg,
  checking,
  found,
  error,
}: {
  id: string;
  reg: string | null;
  checking: boolean;
  found: StudentLookup | undefined;
  error: string | null;
}) {
  const { t } = useTranslation();
  if (!reg) return null;
  if (error)
    return (
      <p id={id} data-testid="recover-lookup" data-state="error" role="alert" className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-brick">
        <XCircle size={14} className="shrink-0" />
        {error}
      </p>
    );
  if (checking || !found)
    return (
      <p id={id} data-testid="recover-lookup" data-state="checking" aria-live="polite" className="mt-1.5 text-[11.5px] text-clay">
        {t("auth.recover.lookup.checking")}
      </p>
    );
  if (!found.found || found.via === "blocked")
    return (
      <p
        id={id}
        data-testid="recover-lookup"
        data-state={found.found ? "blocked" : "missing"}
        role="alert"
        className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-brick"
      >
        <XCircle size={14} className="shrink-0" />
        {t(found.found ? "auth.recover.lookup.blocked" : "auth.recover.lookup.missing")}
      </p>
    );
  return (
    <div id={id} data-testid="recover-lookup" data-state={found.via} aria-live="polite" className="mt-1.5 space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300">
        <BadgeCheck size={14} className="shrink-0" />
        {t("auth.recover.lookup.found")}
      </p>
      <p
        className={cn(
          "rounded-xl px-3 py-2 text-[11.5px] leading-relaxed",
          found.via === "admin" ? "bg-gold/10 text-forest/85 ring-1 ring-gold/25" : "bg-emerald-500/8 text-emerald-800 dark:text-emerald-200",
        )}
      >
        {t(found.via === "admin" ? "auth.recover.lookup.viaAdmin" : "auth.recover.lookup.viaEmail")}
      </p>
    </div>
  );
}

/* ── /reset-password ──────────────────────────────────────── */

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  const token = useLinkToken();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const check = useQuery({
    queryKey: [...KEY, "reset", token],
    queryFn: () => authApi.checkReset(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
  const save = useMutation({ mutationFn: () => authApi.resetPassword(token, password) });

  if (save.isSuccess)
    return (
      <Shell icon={CheckCircle2} tone="ok" title={t("auth.recover.doneTitle")}>
        <Notice tone="ok" testId="reset-done">{save.data.message}</Notice>
        <Link to={localePath(PATHS.login)} className={`${primaryBtn} mt-5`}>
          <LogIn size={17} className="rtl:rotate-180" />
          {t("auth.signIn")}
        </Link>
      </Shell>
    );

  if (!token || check.data === false || check.isError)
    return (
      <Shell icon={ShieldAlert} tone="warn" title={t("auth.recover.invalidTitle")}>
        <Notice tone="error" testId="reset-invalid">{t("auth.recover.invalid")}</Notice>
        <Link to={localePath(PATHS.forgotPassword)} className={`${primaryBtn} mt-5`}>
          <MailQuestion size={17} />
          {t("auth.recover.newLink")}
        </Link>
      </Shell>
    );

  if (check.isLoading)
    return (
      <Shell icon={KeyRound} title={t("auth.recover.resetTitle")}>
        <div className="grid place-items-center py-6">
          <Loader2 size={24} className="animate-spin text-gold" />
        </div>
      </Shell>
    );

  const issue = passwordIssue(password);
  const mismatch = !!again && again !== password;
  const ready = !!password && !issue && password === again;

  return (
    <Shell icon={KeyRound} title={t("auth.recover.resetTitle")} subtitle={t("auth.recover.resetSubtitle")} step={2}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) save.mutate();
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-forest/80">{t("auth.recover.newPassword")}</span>
          {/* The field reads left to right whatever the page: the eye sits on its left, and the text starts past it. */}
          <span className="relative block">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="new-password"
              dir="ltr"
              data-testid="reset-password"
              className={`${inputCls} pl-11 text-start`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={t("auth.togglePassword")}
              className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-clay hover:text-forest"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-forest/80">{t("auth.recover.repeat")}</span>
          <input
            type={show ? "text" : "password"}
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            dir="ltr"
            data-testid="reset-again"
            className={`${inputCls} text-start ${mismatch ? "border-red-400" : ""}`}
          />
          {mismatch && <span className="mt-1 block text-[11.5px] text-red-600 dark:text-red-400">{t("auth.recover.mismatch")}</span>}
        </label>
        <PasswordChecklist value={password} owner={{}} />
        {password && issue && <p className="text-[12px] text-clay">{passwordIssueText(t, password, issue)}</p>}
        {save.isError && <Notice tone="error">{serverMessage(save.error, t("auth.recover.failed"))}</Notice>}
        <button type="submit" disabled={!ready || save.isPending} data-testid="reset-save" className={primaryBtn}>
          {save.isPending ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
          {t("auth.recover.save")}
        </button>
      </form>
    </Shell>
  );
}

/* ── /verify-email ────────────────────────────────────────── */

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  const token = useLinkToken();
  // A query, not an effect: opened once even when the page mounts twice.
  const verify = useQuery({
    queryKey: [...KEY, "verify", token],
    queryFn: () => authApi.verifyEmail(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (verify.isSuccess)
    return (
      <Shell icon={MailCheck} tone="ok" title={t("auth.recover.verifiedTitle")}>
        <Notice tone="ok" testId="verify-done">{verify.data.message}</Notice>
        <p className="mt-3 text-[12.5px] leading-relaxed text-clay">{t("auth.recover.verifiedHint")}</p>
        <Link to={localePath(PATHS.dashboard)} className={`${primaryBtn} mt-5`}>
          <LogIn size={17} className="rtl:rotate-180" />
          {t("auth.recover.toPlatform")}
        </Link>
      </Shell>
    );

  if (token && verify.isLoading)
    return (
      <Shell icon={MailCheck} title={t("auth.recover.verifying")}>
        <div className="grid place-items-center py-6">
          <Loader2 size={24} className="animate-spin text-gold" />
        </div>
      </Shell>
    );

  return (
    <Shell icon={ShieldAlert} tone="warn" title={t("auth.recover.invalidTitle")}>
      <Notice tone="error" testId="verify-invalid">
        {verify.isError ? serverMessage(verify.error, t("auth.recover.verifyInvalid")) : t("auth.recover.verifyInvalid")}
      </Notice>
    </Shell>
  );
}
