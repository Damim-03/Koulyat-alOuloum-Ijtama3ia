import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useTwoFactorLogin } from "../../hooks/use-login";
import { normalizeError, serverMessage } from "../../../../lib/api/error";
import { cn } from "../../../../lib/utils";

/**
 * The second step of an administrator's sign-in: the six digits the
 * authenticator app shows now — or, the phone lost, one of the recovery codes.
 *
 * The ticket from the password lasts five minutes; past that (or after a
 * wrong code too many) the form goes back to the password.
 */
export function TwoFactorStep({
  challenge,
  onSuccess,
  onBack,
}: {
  challenge: string;
  onSuccess?: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const verify = useTwoFactorLogin();
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");

  const send = (value: string) =>
    verify.mutate(
      { challenge, code: value },
      {
        onSuccess: () => onSuccess?.(),
        onError: (err) => {
          const e = normalizeError(err);
          // The server says which: a wrong code, or a ticket that ran out.
          toast.error(e.status === 429 ? e.message : serverMessage(err, e.message));
          setCode("");
          // The ticket ran out (or the account was locked): start again.
          if (e.code === "AUTH_INVALID_TOKEN" || e.status === 429) onBack();
        },
      },
    );

  const ready = recovery ? code.replace(/[^a-z0-9]/gi, "").length === 10 : /^\d{6}$/.test(code);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) send(code);
      }}
      data-testid="login-2fa"
    >
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/8 px-3.5 py-3">
        <span className="grid size-9 flex-none place-items-center rounded-lg bg-gold/15 text-gold">
          {recovery ? <KeyRound size={17} /> : <Smartphone size={17} />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-forest">{t("auth.twoFactor.title")}</p>
          <p className="mt-0.5 text-[12px] leading-[1.7] text-forest/75">
            {recovery ? t("auth.twoFactor.recoveryHint") : t("auth.twoFactor.hint")}
          </p>
        </div>
      </div>

      <label className="mb-1.5 block text-[12.5px] font-semibold text-forest/80">
        {recovery ? t("auth.twoFactor.recoveryLabel") : t("auth.twoFactor.codeLabel")}
      </label>
      <input
        autoFocus
        value={code}
        onChange={(e) => {
          const v = recovery ? e.target.value.slice(0, 11) : e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(v);
          // Six digits typed: no need to look for the button.
          if (!recovery && v.length === 6 && !verify.isPending) send(v);
        }}
        inputMode={recovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        dir="ltr"
        placeholder={recovery ? "abcde-fghjk" : "••••••"}
        data-testid="login-2fa-code"
        className={cn(
          "w-full rounded-xl border border-forest/15 bg-cream-2 py-3 text-center font-mono text-forest outline-none transition placeholder:text-clay/40 focus:border-sage focus:bg-cream-card focus:shadow-[0_0_0_3px_rgba(74,112,102,0.16)]",
          recovery ? "text-[16px] tracking-[0.15em]" : "text-[24px] tracking-[0.6em]",
        )}
      />

      <button
        type="submit"
        disabled={!ready || verify.isPending}
        data-testid="login-2fa-submit"
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-br from-forest-soft to-forest p-3 text-[14.5px] font-bold text-cream shadow-[0_10px_24px_rgba(38,66,61,0.30)] ring-1 ring-inset ring-gold/15 transition hover:-translate-y-px disabled:translate-y-0 disabled:cursor-default disabled:opacity-60"
      >
        {verify.isPending ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
        {t("auth.twoFactor.verify")}
      </button>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <button type="button" onClick={onBack} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-clay hover:text-forest">
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {t("auth.twoFactor.back")}
        </button>
        <button
          type="button"
          onClick={() => {
            setRecovery((r) => !r);
            setCode("");
          }}
          className="cursor-pointer font-semibold text-gold hover:text-gold-soft"
        >
          {recovery ? t("auth.twoFactor.useApp") : t("auth.twoFactor.useRecovery")}
        </button>
      </div>
    </form>
  );
}
