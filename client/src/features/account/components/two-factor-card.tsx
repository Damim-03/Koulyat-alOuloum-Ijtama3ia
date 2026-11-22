import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  KeyRound,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import type { MyAccount, TwoFactorSetup } from "../../../types/account";
import { useAuthStore } from "../../../store/auth.store";
import { useDates } from "../../../hooks/use-dates";
import {
  useDisableTwoFactor,
  useEnableTwoFactor,
  useRenewRecoveryCodes,
  useStartTwoFactor,
} from "../account.api";
import { Field, PrimaryBtn, Secret } from "./form-bits";
import { inputCls } from "../lib/input-class";

/**
 * Two-step verification: after the password, a six-digit code from an app on
 * the administrator's phone (Google Authenticator, Microsoft Authenticator,
 * Aegis, 2FAS…). A stolen password alone then opens nothing.
 *
 * Off: scan a QR code, type the app's first code, put the ten recovery codes
 * somewhere safe. On: how many recovery codes are left, new ones, and turning
 * it off — which, for a required account, is how a new phone replaces the old.
 */
export function TwoFactorCard({ a, gate }: { a: MyAccount; gate?: boolean }) {
  return a.twoFactor.enabled && !gate ? <Enabled a={a} /> : <Setup a={a} />;
}

/** "abcd efgh …" — a key typed by hand is read four letters at a time. */
const grouped = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

function Setup({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const start = useStartTwoFactor();
  const enable = useEnableTwoFactor();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!setup) return;
    let live = true;
    QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 224, errorCorrectionLevel: "M" })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [setup]);

  if (codes) return <RecoveryCodes codes={codes} first />;

  if (!setup) {
    return (
      <Frame tone="gold" icon={ShieldCheck} title={t("account.twoFactor.title")} badge={a.twoFactor.required ? t("account.twoFactor.required") : undefined}>
        <p className="text-[12.5px] leading-relaxed text-clay">{t("account.twoFactor.intro")}</p>
        <ol className="mt-4 grid grid-cols-1 gap-2 text-[12.5px] text-forest sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <li key={n} className="flex items-start gap-2 rounded-2xl border border-forest/10 bg-cream-card p-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold/15 text-[11px] font-bold text-gold">{n}</span>
              {t(`account.twoFactor.step${n}`)}
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <PrimaryBtn icon={QrCode} busy={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: setSetup })} testId="tfa-start">
            {t("account.twoFactor.start")}
          </PrimaryBtn>
        </div>
      </Frame>
    );
  }

  return (
    <Frame tone="gold" icon={QrCode} title={t("account.twoFactor.scanTitle")}>
      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="mx-auto grid size-[232px] place-items-center rounded-2xl border border-forest/10 bg-white p-1">
          {qr ? <img src={qr} alt={t("account.twoFactor.qrAlt")} className="size-[224px]" data-testid="tfa-qr" /> : <Loader2 className="animate-spin text-clay" />}
        </div>
        <div className="min-w-0 space-y-4">
          <p className="text-[12.5px] leading-relaxed text-clay">{t("account.twoFactor.scanHint")}</p>
          <div>
            <p className="mb-1.5 text-[11.5px] font-semibold text-forest">{t("account.twoFactor.manualKey")}</p>
            <div className="flex items-center gap-2 rounded-2xl border border-forest/10 bg-cream-2/50 px-3 py-2.5">
              <code dir="ltr" className="min-w-0 flex-1 font-mono text-[13px] tracking-wider break-all text-forest" data-testid="tfa-secret">
                {grouped(setup.secret)}
              </code>
              <CopyButton text={setup.secret} />
            </div>
            <p className="mt-1 text-[11px] text-clay" dir="ltr">{setup.account}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{6}$/.test(code)) return;
              enable.mutate(code, { onSuccess: setCodes });
            }}
            className="space-y-3"
          >
            <Field label={t("account.twoFactor.firstCode")}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                placeholder="123456"
                data-testid="tfa-code"
                className={`${inputCls()} text-center font-mono text-[20px] tracking-[0.5em]`}
              />
            </Field>
            <PrimaryBtn type="submit" icon={ShieldCheck} busy={enable.isPending} disabled={code.length !== 6} testId="tfa-enable">
              {t("account.twoFactor.enable")}
            </PrimaryBtn>
          </form>
        </div>
      </div>
    </Frame>
  );
}

/**
 * The ten recovery codes — shown this once. Only when they are put away does
 * the account count as protected, and the screen in front of the dashboard
 * step aside.
 */
function RecoveryCodes({ codes, first, onClose }: { codes: string[]; first?: boolean; onClose?: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");

  const done = () => {
    if (first) patchUser({ twoFactorEnabled: true, twoFactorSetupRequired: false });
    qc.invalidateQueries({ queryKey: ["account", "me"] });
    qc.invalidateQueries({ queryKey: ["auth", "me"] });
    onClose?.();
  };

  return (
    <Frame tone="emerald" icon={KeyRound} title={first ? t("account.twoFactor.enabledTitle") : t("account.twoFactor.newCodesTitle")}>
      <p className="text-[12.5px] leading-relaxed text-clay">{t("account.twoFactor.codesHint")}</p>
      <ul dir="ltr" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="tfa-recovery">
        {codes.map((c) => (
          <li key={c} className="rounded-xl border border-forest/10 bg-cream-card px-2 py-2 text-center font-mono text-[12.5px] tracking-wide text-forest">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CopyButton text={text} label={t("account.twoFactor.copyAll")} />
        <button
          type="button"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([`${t("account.twoFactor.fileHeader")}\n\n${text}\n`], { type: "text/plain" }));
            const link = Object.assign(document.createElement("a"), { href: url, download: "recovery-codes.txt" });
            link.click();
            URL.revokeObjectURL(url);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-forest/12 bg-cream-card px-3 py-2 text-[12px] font-semibold text-forest transition hover:bg-forest/5"
        >
          <Download size={14} /> {t("account.twoFactor.download")}
        </button>
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-2 text-[12.5px] text-forest">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-gold)]" data-testid="tfa-saved" />
        {t("account.twoFactor.savedThem")}
      </label>
      <div className="mt-4">
        <PrimaryBtn icon={Check} disabled={!saved} onClick={done} testId="tfa-done">
          {t("account.twoFactor.continue")}
        </PrimaryBtn>
      </div>
    </Frame>
  );
}

function Enabled({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  const renew = useRenewRecoveryCodes();
  const disable = useDisableTwoFactor();
  const [mode, setMode] = useState<"idle" | "renew" | "replace">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const left = a.twoFactor.recoveryCodesLeft;

  if (codes) return <RecoveryCodes codes={codes} onClose={() => setCodes(null)} />;

  const reset = () => {
    setMode("idle");
    setPassword("");
    setCode("");
  };

  return (
    <Frame tone="emerald" icon={ShieldCheck} title={t("account.twoFactor.title")} badge={t("account.twoFactor.on")}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Fact icon={Smartphone} label={t("account.twoFactor.since")} value={a.twoFactor.enabledAt ? fmtDate(a.twoFactor.enabledAt) : "—"} />
        <Fact
          icon={KeyRound}
          label={t("account.twoFactor.codesLeft")}
          value={String(left)}
          warn={left <= 3}
          hint={left <= 3 ? t("account.twoFactor.fewLeft") : undefined}
        />
      </div>

      {mode === "idle" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("renew")} className="inline-flex items-center gap-1.5 rounded-xl border border-forest/12 bg-cream-card px-3 py-2 text-[12px] font-semibold text-forest transition hover:bg-forest/5">
            <RefreshCw size={14} /> {t("account.twoFactor.renew")}
          </button>
          <button type="button" onClick={() => setMode("replace")} className="inline-flex items-center gap-1.5 rounded-xl border border-red-300/60 bg-cream-card px-3 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-500/10 dark:text-red-300">
            <ShieldOff size={14} /> {a.twoFactor.required ? t("account.twoFactor.replace") : t("account.twoFactor.disable")}
          </button>
        </div>
      ) : (
        <form
          className="mt-4 space-y-3 rounded-2xl border border-forest/10 bg-cream-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "renew") renew.mutate(password, { onSuccess: (c) => { reset(); setCodes(c); } });
            else disable.mutate({ currentPassword: password, code }, { onSuccess: reset });
          }}
        >
          <p className="flex items-start gap-2 text-[12px] leading-relaxed text-clay">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-gold" />
            {mode === "renew" ? t("account.twoFactor.renewHint") : a.twoFactor.required ? t("account.twoFactor.replaceHint") : t("account.twoFactor.disableHint")}
          </p>
          <Field label={t("admin.account.currentPassword")}>
            <Secret value={password} onChange={setPassword} autoComplete="current-password" />
          </Field>
          {mode === "replace" && (
            <Field label={t("account.twoFactor.codeOrRecovery")}>
              <input value={code} onChange={(e) => setCode(e.target.value.slice(0, 32))} dir="ltr" autoComplete="one-time-code" className={`${inputCls()} font-mono`} />
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            <PrimaryBtn type="submit" icon={mode === "renew" ? RefreshCw : ShieldOff} busy={renew.isPending || disable.isPending} disabled={!password || (mode === "replace" && code.trim().length < 6)}>
              {mode === "renew" ? t("account.twoFactor.renew") : a.twoFactor.required ? t("account.twoFactor.replace") : t("account.twoFactor.disable")}
            </PrimaryBtn>
            <button type="button" onClick={reset} className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-clay hover:text-forest">
              {t("admin.cancelShort")}
            </button>
          </div>
        </form>
      )}
    </Frame>
  );
}

/* ── small pieces ─────────────────────────────────────────── */

const TONE = {
  gold: { ring: "border-gold/35 bg-gold/5", icon: "bg-gold/15 text-gold", badge: "bg-gold/20 text-forest-deep" },
  emerald: { ring: "border-emerald-400/35 bg-emerald-500/5", icon: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
} as const;

function Frame({
  tone,
  icon: Icon,
  title,
  badge,
  children,
}: {
  tone: keyof typeof TONE;
  icon: typeof ShieldCheck;
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const c = TONE[tone];
  return (
    <section className={`rounded-3xl border p-5 ${c.ring}`} data-testid="two-factor-card">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${c.icon}`}>
          <Icon size={20} />
        </span>
        <h3 className="min-w-0 flex-1 font-serif text-[16px] font-bold text-forest">{title}</h3>
        {badge && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${c.badge}`}>{badge}</span>}
      </div>
      {children}
    </section>
  );
}

function Fact({ icon: Icon, label, value, warn, hint }: { icon: typeof ShieldCheck; label: string; value: string; warn?: boolean; hint?: string }) {
  return (
    <div className="rounded-2xl border border-forest/10 bg-cream-card p-3.5">
      <span className="mb-1 flex items-center gap-1.5 text-[11.5px] text-clay">
        <Icon size={14} className="text-gold" />
        {label}
      </span>
      <b className={`block font-serif text-[17px] ${warn ? "text-amber-700 dark:text-amber-300" : "text-forest"}`}>{value}</b>
      {hint && <span className="mt-0.5 block text-[11px] text-amber-700 dark:text-amber-300">{hint}</span>}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          })
          .catch(() => toast.error(t("account.twoFactor.copyFailed")))
      }
      aria-label={label ?? t("account.twoFactor.copy")}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-forest/12 bg-cream-card px-3 py-2 text-[12px] font-semibold text-forest transition hover:bg-forest/5"
    >
      {done ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
      {label && <span>{label}</span>}
    </button>
  );
}
