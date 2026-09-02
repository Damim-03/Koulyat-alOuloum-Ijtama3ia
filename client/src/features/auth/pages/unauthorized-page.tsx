import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { PATHS } from "../../../routes/paths";
import { useAuth } from "../../../hooks/use-auth";
import { useTranslation } from "react-i18next";

export function UnauthorizedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div
      className="auth-bg grid min-h-svh place-items-center p-7 text-forest"
    >
      <section className="w-full max-w-105 rounded-[22px] border border-forest/10 bg-cream-card p-8 text-center shadow-[0_24px_60px_rgba(26,49,45,0.14)]">
        <div className="mx-auto mb-4.5 grid size-12 place-items-center rounded-xl bg-linear-to-br from-gold-soft to-gold text-forest-deep shadow-[0_10px_26px_rgba(193,150,90,0.30)]">
          <ShieldAlert size={22} />
        </div>

        <h2 className="m-0 font-display text-[24px] font-bold text-forest">{t("auth.unauthorizedTitle")}</h2>
        <p className="mt-1.5 mb-6 text-[13px] leading-relaxed text-clay">{t("auth.unauthorizedBody")}</p>

        <button
          onClick={() => navigate(PATHS.home)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-br from-forest-soft to-forest p-3.25 text-[15px] font-bold text-cream ring-1 ring-inset ring-gold/15 shadow-[0_10px_26px_rgba(38,66,61,0.28)] transition hover:-translate-y-px hover:ring-gold/35"
        >{t("auth.backHome")}</button>

        <p
          onClick={logout}
          className="mt-4 cursor-pointer text-center text-[12.5px] text-clay"
        >
          <span className="font-semibold text-gold hover:text-gold-soft">{t("common.logout")}</span>
        </p>
      </section>
    </div>
  );
}
