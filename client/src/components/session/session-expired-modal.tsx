import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hourglass, LogIn, MonitorX, ShieldAlert } from "lucide-react";
import { AlertAction, AlertShell } from "../dialog/alert-shell";

interface Props {
  open: boolean;
  reason: "idle" | "token" | "revoked";
  onLogin: () => void;
  autoRedirectSeconds?: number;
}

const TEXT = { idle: "Idle", token: "Token", revoked: "Revoked" } as const;

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
    // العدّ يبدأ من أوّله كلّما فُتحت النافذة.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <AlertShell
      open={open}
      top
      tone="warning"
      icon={reason === "idle" ? Hourglass : reason === "revoked" ? MonitorX : ShieldAlert}
      kicker={t("alert.kickerSession")}
      title={t(`session.title${TEXT[reason]}`)}
      message={t(`session.desc${TEXT[reason]}`)}
      actions={
        <AlertAction tone="info" icon={LogIn} onClick={onLogin}>
          {t("session.loginAgain")}
        </AlertAction>
      }
      footnote={
        <>
          {/* العدّ التنازليّ مرئيّاً: شريطٌ يتناقص مع الثواني. */}
          <span className="mx-auto mb-2 block h-1 w-40 overflow-hidden rounded-full bg-forest/10">
            <span
              className="block h-full rounded-full bg-linear-to-l from-gold to-gold-soft transition-[width] duration-1000 ease-linear"
              style={{ width: `${(seconds / autoRedirectSeconds) * 100}%` }}
            />
          </span>
          {t("session.redirectIn", { n: seconds })}
        </>
      }
    />
  );
}
