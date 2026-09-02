import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  Lock,
  Loader2,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import type { LoginRole } from "../../../../types/enums";
import { ROLES } from "../../../../config/roles.config";
import { useLogin } from "../../hooks/use-login";
import { normalizeError } from "../../../../lib/api/error";
import { cn } from "../../../../lib/utils";
import type { LoginDTO } from "../../validation/auth.schema";
import { useTranslation } from "react-i18next";
import { t as translate } from "i18next";

interface Props {
  role: LoginRole;
  onSuccess?: () => void;
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
  "relative flex items-center rounded-xl border bg-cream-2 transition focus-within:border-sage focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(74,112,102,0.16)]";
const inputBase =
  "w-full rounded-xl border-0 bg-transparent py-3 pr-10 text-[14px] text-forest outline-none placeholder:text-clay/50";

export function LoginFormBase({ role, onSuccess }: Props) {
  const { t } = useTranslation();
  const cfg = ROLES[role];
  const FieldIcon = cfg.FieldIcon;

  const [showPw, setShowPw] = useState(false);
  const [hintOpen, setHintOpen] = useState(true);
  const login = useLogin(role);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema(role)) });

  const submit = handleSubmit((values) => {
    const payload = {
      [cfg.fieldName]: values.identifier.trim(),
      password: values.password,
    } as unknown as LoginDTO;
    login.mutate(payload, {
      onSuccess: () => onSuccess?.(),
      onError: (err) => toast.error(normalizeError(err).message),
    });
  });

  return (
    <form onSubmit={submit} noValidate>
      {/* role-specific field hint */}
      {hintOpen && (
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

      {login.isSuccess && (
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
            autoComplete="current-password"
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

      <button
        type="submit"
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
        <span className="cursor-pointer font-semibold text-gold hover:text-gold-soft">{t("auth.contactAdministration")}</span>
      </p>
    </form>
  );
}
