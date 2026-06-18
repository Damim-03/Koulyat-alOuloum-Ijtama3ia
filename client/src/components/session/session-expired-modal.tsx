import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, LogIn } from "lucide-react";

interface Props {
  open: boolean;
  reason: "idle" | "token";
  onLogin: () => void;
  autoRedirectSeconds?: number;
}

export function SessionExpiredModal({
  open,
  reason,
  onLogin,
  autoRedirectSeconds = 15,
}: Props) {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(autoRedirectSeconds);

  useEffect(() => {
    if (!open) return;
    setSeconds(autoRedirectSeconds);
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          onLogin();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, autoRedirectSeconds, onLogin]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 grid place-items-center bg-forest-deep/60 p-6 backdrop-blur-sm">
      <div className="w-full max-w-100 overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-2xl">
        <div className="h-1 bg-linear-to-r from-forest via-gold to-forest" />
        <div className="p-6 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-100">
            <ShieldAlert size={28} className="text-amber-600" />
          </div>
          <h3 className="mb-1.5 font-serif text-lg font-bold text-forest">
            {reason === "idle" ? t("session.titleIdle") : t("session.titleToken")}
          </h3>
          <p className="mb-5 text-[13.5px] leading-[1.8] text-clay">
            {reason === "idle" ? t("session.descIdle") : t("session.descToken")}
          </p>
          <button
            onClick={onLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-forest to-forest-deep py-3 text-sm font-bold text-cream transition hover:-translate-y-px"
          >
            <LogIn size={16} />
            {t("session.loginAgain")}
          </button>
          <p className="mt-3 text-[11px] text-clay/70">
            {t("session.redirectIn", { n: seconds })}
          </p>
        </div>
      </div>
    </div>
  );
}