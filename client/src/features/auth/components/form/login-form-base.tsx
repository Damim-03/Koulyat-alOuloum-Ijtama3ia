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
} from "lucide-react";
import type { LoginRole } from "../../../../types/enums";
import { ROLES } from "../../../../config/roles.config";
import { useLogin } from "../../hooks/use-login";
import { normalizeError } from "../../../../lib/api/error";
import { cn } from "../../../../lib/utils";
import type { LoginDTO } from "../../validation/auth.schema";

interface Props {
  role: LoginRole;
  onSuccess?: () => void;
}

function formSchema(role: LoginRole) {
  const password = z.string().min(1, "كلمة المرور مطلوبة");
  const identifier =
    role === "professor"
      ? z
          .string()
          .regex(
            /^[a-zA-Z0-9._%+-]+@univ-eloued\.dz$/,
            "يجب أن يكون بريداً جامعياً صحيحاً (@univ-eloued.dz)",
          )
      : role === "admin"
        ? z.string().email("بريد إلكتروني غير صحيح")
        : z.string().min(1, "رقم التسجيل مطلوب");
  return z.object({ identifier, password });
}

type FormValues = { identifier: string; password: string };

const inputWrap =
  "relative flex items-center rounded-xl border bg-white/[0.03] transition focus-within:border-teal focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_3px_rgba(45,212,191,0.15)]";
const inputBase =
  "w-full rounded-xl border-0 bg-transparent py-3 pr-10 text-[14px] text-fg outline-none placeholder:text-muted2";

export function LoginFormBase({ role, onSuccess }: Props) {
  const cfg = ROLES[role];
  const FieldIcon = cfg.FieldIcon;

  const [showPw, setShowPw] = useState(false);
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
      {login.isSuccess && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-mint/25 bg-mint/[0.08] px-3 py-2.5 text-[12.5px] text-mint">
          <CheckCircle2 size={16} />
          تم تسجيل الدخول بنجاح.
        </div>
      )}

      {/* identifier */}
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[12.5px] font-medium text-fg/90">
          {cfg.fieldLabel}
        </label>
        <div
          className={cn(
            inputWrap,
            errors.identifier
              ? "border-red-400/60 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]"
              : "border-white/[0.08]",
          )}
        >
          <FieldIcon
            size={16}
            className="pointer-events-none absolute right-3 text-muted"
          />
          <input
            type={cfg.inputType}
            inputMode={role === "student" ? "numeric" : "email"}
            placeholder={cfg.placeholder}
            autoComplete="username"
            className={cn(inputBase, "pl-3.5")}
            {...register("identifier")}
          />
        </div>
        {errors.identifier && (
          <span className="mt-1 block text-[11.5px] text-red-300">
            {errors.identifier.message}
          </span>
        )}
      </div>

      {/* password */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[12.5px] font-medium text-fg/90">
          كلمة المرور
        </label>
        <div
          className={cn(
            inputWrap,
            errors.password
              ? "border-red-400/60 shadow-[0_0_0_3px_rgba(248,113,113,0.12)]"
              : "border-white/[0.08]",
          )}
        >
          <Lock
            size={16}
            className="pointer-events-none absolute right-3 text-muted"
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
            aria-label="إظهار/إخفاء كلمة المرور"
            className="absolute left-2.5 grid cursor-pointer place-items-center rounded-md p-1.5 text-muted transition hover:text-fg"
          >
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && (
          <span className="mt-1 block text-[11.5px] text-red-300">
            {errors.password.message}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={login.isPending}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-mint to-teal p-3 text-[14.5px] font-bold text-[#06302a] shadow-[0_8px_22px_rgba(45,212,191,0.28)] transition hover:-translate-y-px hover:brightness-105 disabled:translate-y-0 disabled:cursor-default disabled:opacity-70"
      >
        {login.isPending ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <ArrowLeft size={17} />
        )}
        تسجيل الدخول
      </button>

      <p className="mt-3.5 text-center text-[12px] text-muted">
        نسيت كلمة المرور؟{" "}
        <span className="cursor-pointer text-teal">تواصل مع الإدارة</span>
      </p>
    </form>
  );
}
