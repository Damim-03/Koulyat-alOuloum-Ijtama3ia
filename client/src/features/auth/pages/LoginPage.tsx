import { useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../../../hooks/use-language";
import { HelpCircle, GraduationCap, ArrowRight } from "lucide-react";
import type { LoginRole } from "../../../types/enums";
import { PATHS } from "../../../routes/paths";
import { ROLES } from "../../../config/roles.config";
import { RoleSwitcher } from "../components/role-switcher";
import { StudentLoginForm } from "../components/form/student-login-form";
import { ProfessorLoginForm } from "../components/form/professor-login-form";
import { HelpDialog } from "../components/help-dialog";
import { AuthHero } from "../components/auth-hero";
import { AdminLoginForm } from "../components/form/admin-login-form";
import { useTranslation } from "react-i18next";

const FORMS: Record<LoginRole, (p: { onSuccess?: () => void }) => ReactNode> = {
  student: StudentLoginForm,
  professor: ProfessorLoginForm,
  admin: AdminLoginForm,
};

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { localePath } = useLanguage();
  const [role, setRole] = useState<LoginRole>("student");
  const [helpOpen, setHelpOpen] = useState(false);
  const cfg = ROLES[role];
  const ActiveForm = FORMS[role];

  // After login, return the user to the page they came from (e.g. the topics
  // page they were redirected away from). If there is no such page, fall back
  // to the role-based dashboard.
  const from = (location.state as { from?: string } | null)?.from;
  function handleLoginSuccess() {
    navigate(from ?? localePath(PATHS.dashboard), { replace: true });
  }

  return (
    <div
      className="auth-bg relative grid min-h-svh w-full text-forest lg:grid-cols-2"
    >
      {/* back to homepage — pinned top-left */}
      <button
        type="button"
        onClick={() => navigate(localePath(PATHS.home))}
        className="absolute left-5 top-5 z-20 inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-forest/10 bg-cream-card/70 px-3 py-1.5 text-[12.5px] font-semibold text-clay shadow-sm backdrop-blur-sm transition hover:border-forest/20 hover:text-forest"
      >
        <ArrowRight size={15} className="ltr:rotate-180" />{t("auth.backHome")}</button>
      {/* LEFT: hero panel (desktop) */}
      <AuthHero />

      {/* RIGHT: form panel */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-110 animate-[fadeUp_0.6s_0.12s_both]">
          {/* mobile mini-brand (hero is hidden on small) */}
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-linear-to-br from-gold-soft to-gold text-forest-deep">
              <GraduationCap size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-[13px] font-bold text-forest">{t("auth.universityName")}</div>
              <div className="text-[11px] text-clay">{t("auth.heroSystem")}</div>
            </div>
          </div>

          <RoleSwitcher value={role} onChange={setRole} />

          <div className="mt-6 rounded-[22px] border border-forest/10 bg-cream-card p-7 shadow-[0_24px_60px_rgba(26,49,45,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="m-0 font-display text-[24px] font-bold text-forest">{t("common.login")}</h2>
                <p className="mt-1.5 text-[13px] leading-[1.6] text-clay">
                  {t(cfg.subtitleKey)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-[10px] border border-gold/35 bg-gold/12 px-2.5 py-1.5 text-[12.5px] font-semibold text-gold transition hover:bg-gold/20"
              >
                <HelpCircle size={15} />{t("auth.help")}</button>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-clay/70 before:h-px before:flex-1 before:bg-forest/10 after:h-px after:flex-1 after:bg-forest/10">
              <span>{t("auth.viaUniversityCredentials")}</span>
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
