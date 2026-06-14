import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { UserPlus, User, Mail, AtSign, Lock, Shield, Eye, EyeOff, Save } from "lucide-react";
import { FormDialog, Field, inputClass } from "./form-dialog";
import { createUserSchema, type CreateUserInput } from "../validation/admin.schema";
import { useCreateUser } from "../hooks/admin-hook";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Strip empty strings → undefined before sending to the backend. */
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== "" && v !== undefined && v !== null) out[k] = v;
  }
  return out as Partial<T>;
}

export function UserFormDialog({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const createUser = useCreateUser();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "student" },
  });

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) reset({ role: "student" });
  }, [open, reset]);

  function onSubmit(values: CreateUserInput) {
    createUser.mutate(clean(values), {
      onSuccess: () => {
        onClose();
        reset();
      },
    });
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t("admin.addUser")}
      subtitle={t("admin.addUserSubtitle")}
      icon={UserPlus}
      footer={
        <>
          <button
            type="submit"
            form="user-form"
            disabled={createUser.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-forest-deep transition hover:bg-gold-soft disabled:opacity-60"
          >
            <Save size={16} />
            {createUser.isPending ? t("admin.saving") : t("admin.saveData")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-forest/20 px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5"
          >
            {t("admin.cancel")}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("admin.firstName")} icon={User} error={errors.firstName?.message}>
            <input {...register("firstName")} className={inputClass} placeholder={t("admin.firstNamePlaceholder")} />
          </Field>
          <Field label={t("admin.lastName")} icon={User} error={errors.lastName?.message}>
            <input {...register("lastName")} className={inputClass} placeholder={t("admin.lastNamePlaceholder")} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("admin.email")} icon={Mail} error={errors.email?.message}>
            <input {...register("email")} dir="ltr" className={inputClass} placeholder="example@univ-eloued.dz" />
          </Field>
          <Field label={t("admin.username")} icon={AtSign} error={errors.username?.message}>
            <input {...register("username")} dir="ltr" className={inputClass} placeholder="username" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("admin.userRole")} icon={Shield} error={errors.role?.message}>
            <select {...register("role")} className={inputClass}>
              <option value="student">{t("role.student")}</option>
              <option value="professor">{t("role.professor")}</option>
              <option value="admin">{t("role.admin")}</option>
              <option value="owner">{t("role.owner")}</option>
            </select>
          </Field>
          <Field label={t("admin.password")} icon={Lock} error={errors.password?.message}>
            <div className="relative">
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                dir="ltr"
                className={inputClass}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-clay hover:text-forest"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
        </div>

        {/* Important note */}
        <div className="rounded-xl bg-cream-2 px-4 py-3">
          <p className="mb-1 text-xs font-bold text-forest">{t("admin.importantNote")}</p>
          <p className="text-[11px] leading-relaxed text-clay">{t("admin.userNoteBody")}</p>
        </div>
      </form>
    </FormDialog>
  );
}