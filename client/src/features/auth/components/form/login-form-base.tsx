import { useRef, useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import axios from "axios";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  Lock,
  Loader2,
  CheckCircle2,
  Info,
  X,
  ClipboardCheck,
} from "lucide-react";
import type { LoginRole } from "../../../../types/enums";
import { ROLES } from "../../../../config/roles.config";
import { useLogin } from "../../hooks/use-login";
import { normalizeError } from "../../../../lib/api/error";
import { cn } from "../../../../lib/utils";
import type { LoginDTO } from "../../validation/auth.schema";
import { useTranslation } from "react-i18next";
import { t as translate } from "i18next";
import { needsSecondStep } from "../../../../types/auth";
import { TwoFactorStep } from "./two-factor-step";
import { SignInCheck } from "./signin-check";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../api/auth.api";
import { useLanguage } from "../../../../hooks/use-language";
import { PATHS } from "../../../../routes/paths";

interface Props {
  role: LoginRole;
  onSuccess?: () => void;
  /**
   * Back from «نسيت كلمة المرور» with the password the administration wrote,
   * just copied: this registration number filled in, and what to do next.
   */
  recovered?: string;
}

// Short field hint shown above the inputs, specific to the selected role.
// The form remounts on role change (key={role} in LoginPage), so this hint
// reappears for each role the first time it is shown.
// Keys, not copy: this map is built once at import time.
const FIELD_HINT_KEY: Record<LoginRole, string> = {
  student: "auth.studentHint",
  professor: "auth.professorHint",
  admin: "auth.adminHint",
};

function formSchema(role: LoginRole) {
  const password = z.string().min(1, translate("validation.passwordRequired"));
  const identifier =
    role === "professor"
      ? // الصيغة فقط — النطاقات المسموح بها تديرها الإدارة في القاعدة.
        z.string().email(translate("validation.emailInvalid"))
      : role === "admin"
        ? z.string().email(translate("validation.emailInvalid"))
        : z.string().min(1, translate("validation.regNumberRequired"));
  return z.object({ identifier, password });
}

type FormValues = { identifier: string; password: string };

const inputWrap =
  "relative flex items-center rounded-xl border bg-cream-2 transition focus-within:border-sage focus-within:bg-cream-card focus-within:shadow-[0_0_0_3px_rgba(74,112,102,0.16)]";
const inputBase =
  "w-full rounded-xl border-0 bg-transparent py-3 pr-10 text-[14px] text-forest outline-none placeholder:text-clay/50";

export function LoginFormBase({ role, onSuccess, recovered }: Props) {
  const { t } = useTranslation();
  const { localePath } = useLanguage();
  // "Forgot my password" by email — when this server sends mail.
  const canRecover =
    useQuery({ queryKey: ["auth", "email-links", "available"], queryFn: authApi.resetAvailable, staleTime: 5 * 60_000, retry: false })
      .data === true;
  const cfg = ROLES[role];
  const FieldIcon = cfg.FieldIcon;

  const [showPw, setShowPw] = useState(false);
  const [hintOpen, setHintOpen] = useState(true);
  // An administrator with two-step verification: the password earned this
  // ticket, and the form now asks for the app's code.
  const [challenge, setChallenge] = useState<string | null>(null);
  const login = useLogin(role);

  // The short check the server asks for after repeated failures (see
  // SignInCheck). A solution opens one sign-in, so each one sent is replaced
  // by a fresh widget that solves the next in the background.
  const [check, setCheck] = useState(false);
  /** The level the server asked for: the proof of work, or with the picture's code. */
  const [level, setLevel] = useState<"work" | "image">("work");
  const [round, setRound] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const solution = useRef<string | null>(null);
  const waitingRef = useRef(false);
  /** Refusals in a row that carried a solution: past two, stop retrying by itself. */
  const refusedSolved = useRef(0);
  const wait = (v: boolean) => {
    waitingRef.current = v;
    setWaiting(v);
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema(role)),
    defaultValues: { identifier: recovered ?? "", password: "" },
  });

  const onValid = (values: FormValues) => {
    // Asked for and not solved yet: the sign-in goes the moment it is.
    if (check && !solution.current) {
      wait(true);
      return;
    }
    const altcha = solution.current;
    if (altcha) {
      solution.current = null;
      setRound((r) => r + 1);
    }
    const payload = {
      [cfg.fieldName]: values.identifier.trim(),
      password: values.password,
      ...(altcha ? { altcha } : {}),
    } as unknown as LoginDTO;
    login.mutate(payload, {
      onSuccess: (res) => (needsSecondStep(res) ? setChallenge(res.challenge) : onSuccess?.()),
      onError: (err) => {
        const e = normalizeError(err);
        if (e.code === "AUTH_CAPTCHA_REQUIRED") {
          refusedSolved.current = altcha ? refusedSolved.current + 1 : 0;
          const asked = axios.isAxiosError(err) && (err.response?.data as { captcha?: string })?.captcha === "image" ? "image" : "work";
          // A proof of work solved for the lower level does not open the higher one.
          if (asked !== level) solution.current = null;
          setLevel(asked);
          setCheck(true);
          // The box explains; the sign-in is sent again once it is solved —
          // unless solutions keep being refused, which no retry would fix.
          if (refusedSolved.current < 2) return wait(true);
        } else refusedSolved.current = 0;
        wait(false);
        toast.error(e.message);
      },
    });
  };
  // Built when used, not while rendering: the check sends it by itself too.
  const submit = (e?: BaseSyntheticEvent) => handleSubmit(onValid)(e);

  const onVerified = (payload: string) => {
    solution.current = payload;
    if (waitingRef.current) {
      wait(false);
      void submit();
    }
  };
  const onReset = () => {
    solution.current = null;
  };

  if (challenge) {
    return (
      <TwoFactorStep
        challenge={challenge}
        onSuccess={onSuccess}
        onBack={() => {
          setChallenge(null);
          login.reset();
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* Back with a password from the administration: what to do with what was copied. */}
      {recovered ? (
        <div
          data-testid="login-recovered"
          role="status"
          className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5 animate-[fadeUp_0.3s_both]"
        >
          <ClipboardCheck size={16} className="mt-0.5 flex-none text-gold" />
          <p className="flex-1 text-[12px] leading-[1.7] text-forest/85">{t("auth.recover.loginNote")}</p>
        </div>
      ) : null}

      {/* role-specific field hint */}
      {!recovered && hintOpen && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-sage/25 bg-sage/8 px-3 py-2.5 animate-[fadeUp_0.3s_both]">
          <Info size={15} className="mt-0.5 flex-none text-sage" />
          <p className="flex-1 text-[12px] leading-[1.7] text-forest/80">
            {t(FIELD_HINT_KEY[role])}
          </p>
          <button
            type="button"
            onClick={() => setHintOpen(false)}
            aria-label={t("auth.hideHint")}
            className="-mt-0.5 grid flex-none cursor-pointer place-items-center rounded-md p-1 text-clay transition hover:text-forest"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {login.isSuccess && !needsSecondStep(login.data) && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-sage/30 bg-sage/10 px-3 py-2.5 text-[12.5px] text-forest">
          <CheckCircle2 size={16} className="text-sage" />{t("auth.signedInSuccessfully")}</div>
      )}

      {/* identifier */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-forest/80">
          {t(cfg.fieldLabelKey)}
        </label>
        <div
          className={cn(
            inputWrap,
            errors.identifier
              ? "border-brick/55 shadow-[0_0_0_3px_rgba(168,68,45,0.12)]"
              : "border-forest/15",
          )}
        >
          <FieldIcon
            size={16}
            className="pointer-events-none absolute right-3 text-clay"
          />
          <input
            type={cfg.inputType}
            inputMode={role === "student" ? "numeric" : "email"}
            placeholder={t(cfg.placeholderKey)}
            autoComplete="username"
            data-testid="login-identifier"
            className={cn(inputBase, "pl-3.5")}
            {...register("identifier")}
          />
        </div>
        {errors.identifier && (
          <span className="mt-1 block text-[11.5px] text-brick">
            {errors.identifier.message}
          </span>
        )}
      </div>

      {/* password */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-forest/80">{t("admin.password")}</label>
        <div
          className={cn(
            inputWrap,
            errors.password
              ? "border-brick/55 shadow-[0_0_0_3px_rgba(168,68,45,0.12)]"
              : "border-forest/15",
          )}
        >
          <Lock
            size={16}
            className="pointer-events-none absolute right-3 text-clay"
          />
          <input
            type={showPw ? "text" : "password"}
            placeholder="••••••••"
            autoFocus={!!recovered}
            autoComplete="current-password"
            data-testid="login-password"
            className={cn(inputBase, "pl-11")}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            aria-label={t("auth.togglePassword")}
            className="absolute left-2.5 grid cursor-pointer place-items-center rounded-md p-1.5 text-clay transition hover:text-forest"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && (
          <span className="mt-1 block text-[11.5px] text-brick">
            {errors.password.message}
          </span>
        )}
      </div>

      {check && (
        <SignInCheck
          key={`${level}-${round}`}
          level={level}
          onVerified={onVerified}
          onReset={onReset}
          onCancel={() => wait(false)}
          waiting={waiting}
        />
      )}

      <button
        type="submit"
        data-testid="login-submit"
        disabled={login.isPending}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-br from-forest-soft to-forest p-3 text-[14.5px] font-bold text-cream shadow-[0_10px_24px_rgba(38,66,61,0.30)] ring-1 ring-inset ring-gold/15 transition hover:-translate-y-px hover:shadow-[0_12px_28px_rgba(38,66,61,0.38)] hover:ring-gold/35 disabled:translate-y-0 disabled:cursor-default disabled:opacity-70"
      >
        {login.isPending ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <ArrowLeft size={17} className="ltr:rotate-180" />
        )}
        {t("auth.signIn")}
      </button>

      <p className="mt-3.5 text-center text-[12px] text-clay">
        {t("auth.forgotPasswordQ")}{" "}
        {/* By email when this server sends mail; otherwise, the administration — save for a
            student, whose request goes to the administration from that page all the same. */}
        {canRecover || role === "student" ? (
          // From the professor's (or administrator's) tab, the page opens on the email side.
          <Link to={`${localePath(PATHS.forgotPassword)}${role === "student" ? "" : "?as=professor"}`} data-testid="login-forgot" className="font-semibold text-gold hover:text-gold-soft">
            {t(role === "student" ? "auth.recover.forStudent" : "auth.recover.byEmail")}
          </Link>
        ) : (
          <span className="cursor-pointer font-semibold text-gold hover:text-gold-soft">{t("auth.contactAdministration")}</span>
        )}
      </p>
    </form>
  );
}
