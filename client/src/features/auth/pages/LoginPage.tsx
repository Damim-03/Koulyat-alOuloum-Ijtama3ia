import { useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../../../hooks/use-language";
import { HelpCircle, GraduationCap } from "lucide-react";
import type { LoginRole } from "../../../types/enums";
import { PATHS } from "../../../routes/paths";
import { ROLES } from "../../../config/roles.config";
import { RoleSwitcher } from "../components/role-switcher";
import { StudentLoginForm } from "../components/form/student-login-form";
import { ProfessorLoginForm } from "../components/form/professor-login-form";
import { HelpDialog } from "../components/help-dialog";
import { AuthHero } from "../components/auth-hero";
import { AdminLoginForm } from "../components/form/admin-login-form";

const FORMS: Record<LoginRole, (p: { onSuccess?: () => void }) => ReactNode> = {
  student: StudentLoginForm,
  professor: ProfessorLoginForm,
  admin: AdminLoginForm,
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { localePath } = useLanguage();
  const [role, setRole] = useState<LoginRole>("student");
  const [helpOpen, setHelpOpen] = useState(false);
  const cfg = ROLES[role];
  const ActiveForm = FORMS[role];

  // Where to go after a successful login. If the user was redirected here
  // from a protected/public page (e.g. a topic detail where they clicked
  // "apply"), `location.state.from` holds that path → return them there.
  // Otherwise fall back to the role-based dashboard as before.
  const from = (location.state as { from?: string } | null)?.from;
  function handleLoginSuccess() {
    navigate(from ?? localePath(PATHS.dashboard), { replace: true });
  }

  return (
    <div
      dir="rtl"
      className="auth-bg grid min-h-svh w-full font-sans text-fg lg:grid-cols-2"
    >
      {/* LEFT: hero panel (desktop) */}
      <AuthHero />

      {/* RIGHT: form panel */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-110 animate-[fadeUp_0.6s_0.12s_both]">
          {/* mobile mini-brand (hero is hidden on small) */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-linear-to-br from-mint to-teal text-[#06302a]">
              <GraduationCap size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-[13px] font-bold">جامعة الشهيد حمه لخضر</div>
              <div className="text-[11px] text-muted">
                نظام إدارة مشاريع التخرج
              </div>
            </div>
          </div>

          <RoleSwitcher value={role} onChange={setRole} />

          <div className="mt-6 rounded-[22px] border border-white/[0.07] bg-panel p-7 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="m-0 font-display text-[22px] font-bold">
                  تسجيل الدخول
                </h2>
                <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">
                  {cfg.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-[10px] border border-teal/25 bg-teal/[0.08] px-2.5 py-1.5 text-[12.5px] font-semibold text-teal transition hover:bg-teal/15"
              >
                <HelpCircle size={15} />
                مساعدة
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-muted2 before:h-px before:flex-1 before:bg-white/[0.07] after:h-px after:flex-1 after:bg-white/[0.07]">
              <span>عبر بيانات الجامعة</span>
            </div>

            <ActiveForm key={role} onSuccess={handleLoginSuccess} />
          </div>
        </div>
      </section>

      <HelpDialog
        role={role}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}
