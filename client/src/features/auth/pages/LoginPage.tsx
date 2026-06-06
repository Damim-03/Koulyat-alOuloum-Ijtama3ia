import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import type { LoginRole } from "../../../types/enums";
import { PATHS } from "../../../routes/paths";
import { ROLES } from "../../../config/roles.config";
import { RoleSwitcher } from "../components/role-switcher";
import { StudentLoginForm } from "../components/student-login-form";
import { ProfessorLoginForm } from "../components/professor-login-form";
import { AdminLoginForm } from "../components/admin-login-form";
import { HelpDialog } from "../components/help-dialog";
import { AuthHero } from "../components/auth-hero";

const FORMS: Record<
  LoginRole,
  (props: { onSuccess?: () => void }) => ReactNode
> = {
  student: StudentLoginForm,
  professor: ProfessorLoginForm,
  admin: AdminLoginForm,
};

export function LoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<LoginRole>("student");
  const [helpOpen, setHelpOpen] = useState(false);
  const cfg = ROLES[role];

  const ActiveForm = FORMS[role];

  return (
    <div
      dir="rtl"
      className="auth-bg flex min-h-svh w-full items-center justify-center p-7 font-sans text-fg"
    >
      <div className="grid w-full max-w-265 items-center gap-14 md:grid-cols-2">
        <AuthHero />

        <section className="rounded-[22px] border border-white/[0.07] bg-panel p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)] max-md:order-1 [animation:fadeUp_0.6s_0.12s_both]">
          <RoleSwitcher value={role} onChange={setRole} />

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="m-0 font-display text-[23px] font-bold">تسجيل الدخول</h2>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">{cfg.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-[10px] border border-[rgba(45,212,191,0.22)] bg-[rgba(45,212,191,0.08)] px-2.5 py-1.5 text-[12.5px] font-semibold text-teal transition hover:bg-[rgba(45,212,191,0.16)]"
            >
              <HelpCircle size={15} />
              مساعدة
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted2 before:h-px before:flex-1 before:bg-white/[0.07] after:h-px after:flex-1 after:bg-white/[0.07]">
            <span>عبر بيانات الجامعة</span>
          </div>

          <ActiveForm
            key={role}
            onSuccess={() => navigate(PATHS.home, { replace: true })}
          />
        </section>
      </div>

      <HelpDialog role={role} open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}