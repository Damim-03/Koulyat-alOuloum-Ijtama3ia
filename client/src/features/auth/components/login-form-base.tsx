import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft, Lock, Loader2, CheckCircle2 } from "lucide-react";
import type { LoginRole } from "../../../types/enums";
import { ROLES } from "../../../config/roles.config";
import { useLogin } from "../hooks/use-login";
import { normalizeError } from "../../../lib/api/error";
import { cn } from "../../../lib/utils";
import type { LoginDTO } from "../validation/auth.schema";

interface Props {
  role: LoginRole;
  onSuccess?: () => void;
}

function formSchema(role: LoginRole) {
  const password = z.string().min(1, "كلمة المرور مطلوبة");
  const identifier =
    role === "professor"
      ? z.string().regex(/^[a-zA-Z0-9._%+-]+@univ-eloued\.dz$/, "يجب أن يكون بريداً جامعياً صحيحاً (@univ-eloued.dz)")
      : role === "admin"
        ? z.string().email("بريد إلكتروني غير صحيح")
        : z.string().min(1, "رقم التسجيل مطلوب");
  return z.object({ identifier, password });
}

type FormValues = { identifier: string; password: string };

const inputWrap =
  "relative flex items-center rounded-xl border bg-white transition focus-within:border-teal focus-within:shadow-[0_0_0_3px_rgba(45,212,191,0.18)]";

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
    login.mutate(payload, { onSuccess: () => onSuccess?.() });
  });

  const serverError = login.isError ? normalizeError(login.error) : null;

  return (
    <form onSubmit={submit} noValidate>
      {login.isSuccess && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(52,211,153,0.25)] bg-[rgba(52,211,153,0.08)] px-3.5 py-[11px] text-[13px] text-mint">
          <CheckCircle2 size={17} />
          تم تسجيل الدخول بنجاح.
        </div>
      )}
      {serverError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[rgba(248,113,113,0.25)] bg-[rgba(248,113,113,0.08)] px-3.5 py-[11px] text-[13px] text-[#fca5a5]">
          {serverError.message}
        </div>
      )}

      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-medium">{cfg.fieldLabel}</label>
        <div className={cn(inputWrap, errors.identifier ? "border-[#f87171] shadow-[0_0_0_3px_rgba(248,113,113,0.15)]" : "border-black/[0.06]")}>
          <FieldIcon size={17} className="pointer-events-none absolute right-[13px] text-[#9aa3ad]" />
          <input
            type={cfg.inputType}
            inputMode={role === "student" ? "numeric" : "email"}
            placeholder={cfg.placeholder}
            autoComplete="username"
            className="w-full rounded-xl border-0 bg-transparent py-[13px] pr-10 pl-3.5 text-[14.5px] text-[#0f172a] outline-none placeholder:text-[#aab2bb]"
            {...register("identifier")}
          />
        </div>
        {errors.identifier && <span className="mt-1.5 block text-xs text-[#f87171]">{errors.identifier.message}</span>}
      </div>

      <div className="mb-4">
        <label className="mb-2 block text-[13px] font-medium">كلمة المرور</label>
        <div className={cn(inputWrap, errors.password ? "border-[#f87171] shadow-[0_0_0_3px_rgba(248,113,113,0.15)]" : "border-black/[0.06]")}>
          <Lock size={17} className="pointer-events-none absolute right-[13px] text-[#9aa3ad]" />
          <input
            type={showPw ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border-0 bg-transparent py-[13px] pr-10 pl-[42px] text-[14.5px] text-[#0f172a] outline-none placeholder:text-[#aab2bb]"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPw((s) => !s)}
            aria-label="إظهار/إخفاء كلمة المرور"
            className="absolute left-2.5 grid cursor-pointer place-items-center rounded-lg p-1.5 text-[#9aa3ad] hover:text-[#0f172a]"
          >
            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {errors.password && <span className="mt-1.5 block text-xs text-[#f87171]">{errors.password.message}</span>}
      </div>

      <button
        type="submit"
        disabled={login.isPending}
        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-mint to-teal p-[13px] text-[15px] font-bold text-[#06302a] shadow-[0_10px_26px_rgba(45,212,191,0.3)] transition hover:-translate-y-px hover:brightness-105 disabled:translate-y-0 disabled:cursor-default disabled:opacity-70"
      >
        {login.isPending ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={18} />}
        تسجيل الدخول
      </button>

      <p className="mt-4 text-center text-[12.5px] text-muted">
        نسيت كلمة المرور؟ <span className="cursor-pointer text-teal">تواصل مع الإدارة</span>
      </p>
    </form>
  );
}