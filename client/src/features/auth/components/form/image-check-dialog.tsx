import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw, ScanEye, ShieldCheck } from "lucide-react";
import { AlertAction, AlertShell } from "../../../../components/dialog/alert-shell";
import { authApi } from "../../api/auth.api";
import { solveWork } from "../../lib/solve-work";

/** Arabic-Indic and Persian digits typed on an Arabic keyboard, read as the code's digits. */
const toLatinDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");

/**
 * نافذة رمز الصورة — الدرجة الثانية من تحقّق الدخول (Backend modules/auth/captcha).
 *
 * كانت نافذة الأداة نفسها: فقاعةٌ صغيرة تنفتح فوق حقلي الرقم وكلمة المرور.
 * وهي الآن نافذة المنصّة: الصورة كبيرةً واضحة، وحقلٌ للرمز بأرقامٍ كبيرة،
 * و«صورة أخرى» حين لا تتّضح.
 *
 * والمسألة الحسابية تُحلّ في الخلفية منذ أن تظهر الصورة، فحين يكتب الطالب
 * الرمز يكون الحلّ جاهزاً غالباً. و«تحقّق» يرسلهما معاً؛ والخادم يجيب
 * بتصريحٍ لدخولٍ واحد — أو بالسبب، فتأتي صورةٌ جديدة مكانها: المسألة احترقت
 * بالمحاولة، فلا يُجرَّب على الصورة نفسها رمزٌ ثانٍ.
 *
 * تُركَّب حين تُفتح وتُفكَّك حين تُغلق، فتبدأ كلّ مرّةٍ بصورةٍ جديدة وحقلٍ فارغ.
 */
export function ImageCheckDialog({
  onClose,
  onPass,
}: {
  onClose: () => void;
  /** التصريح، يُرسل مع الدخول. */
  onPass: (pass: string) => void;
}) {
  const { t } = useTranslation();
  // Each picture is good for one try: a new one per `round`, never cached.
  const [round, setRound] = useState(0);
  const query = useQuery({
    queryKey: ["auth", "image-challenge", round],
    queryFn: authApi.imageChallenge,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const challenge = query.data ?? null;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const work = useRef<Promise<string> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const length = challenge?.codeChallenge.length ?? 5;

  // The picture's proof of work starts solving the moment it arrives; by the
  // time the code is typed, it is usually done.
  useEffect(() => {
    if (!challenge) return;
    const controller = new AbortController();
    work.current = solveWork(challenge, controller.signal);
    // Awaited on «verify»; a failure here must not go unhandled meanwhile.
    work.current.catch(() => undefined);
    input.current?.focus();
    return () => controller.abort();
  }, [challenge]);

  /** «صورة أخرى»، أو بعد رمزٍ رُدّ. */
  const reload = () => {
    work.current = null;
    setCode("");
    setRound((r) => r + 1);
  };

  const verify = async () => {
    if (!challenge || code.length < length || busy || !work.current) return;
    setBusy(true);
    try {
      const payload = await work.current;
      const res = await authApi.verifyImageCode(payload, code);
      if (res.verified && res.payload) return onPass(res.payload);
      setError(res.reason ?? t("auth.captcha.retry"));
    } catch {
      setError(t("auth.captcha.loadFailed"));
    } finally {
      setBusy(false);
    }
    reload();
  };

  return (
    <AlertShell
      open
      tone="info"
      icon={ScanEye}
      kicker={t("auth.captcha.dialogKicker")}
      title={t("auth.captcha.dialogTitle")}
      onClose={onClose}
      busy={busy}
      actions={
        <>
          <AlertAction variant="ghost" onClick={onClose} disabled={busy}>
            {t("auth.captcha.cancel")}
          </AlertAction>
          <AlertAction
            tone="info"
            icon={ShieldCheck}
            onClick={() => void verify()}
            loading={busy}
            disabled={!challenge || code.length < length}
            testid="image-verify"
          >
            {t("auth.captcha.verify")}
          </AlertAction>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <div className="relative overflow-hidden rounded-2xl border border-gold/30 bg-[#f4efe3] p-2 shadow-[inset_0_2px_10px_rgba(38,66,61,0.12)]">
          {challenge ? (
            <img
              src={challenge.codeChallenge.image}
              alt={t("auth.captcha.imageAlt")}
              draggable={false}
              data-testid="image-code-picture"
              className="mx-auto block aspect-[200/72] h-auto w-full max-w-[380px] select-none"
            />
          ) : (
            <div className="mx-auto grid aspect-[200/72] w-full max-w-[380px] place-items-center">
              {query.isError ? (
                <span className="text-[12px] text-brick">{t("auth.captcha.loadFailed")}</span>
              ) : (
                <Loader2 size={22} className="animate-spin text-clay" />
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <input
            ref={input}
            value={code}
            onChange={(e) => {
              setError(null);
              setCode(toLatinDigits(e.target.value).slice(0, length));
            }}
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            maxLength={length * 2}
            disabled={busy}
            aria-label={t("auth.captcha.codeLabel")}
            placeholder={"•".repeat(length)}
            data-testid="image-code"
            className="h-14 min-w-0 flex-1 rounded-2xl border border-forest/15 bg-cream-2 text-center font-serif text-[26px] font-bold tracking-[0.45em] text-forest outline-none transition placeholder:text-clay/40 focus:border-gold focus:ring-4 focus:ring-gold/15 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => {
              setError(null);
              reload();
            }}
            disabled={busy}
            title={t("auth.captcha.newImage")}
            aria-label={t("auth.captcha.newImage")}
            className="box-border grid size-14 shrink-0 place-items-center rounded-2xl border border-forest/15 bg-cream-card p-0 text-clay transition hover:border-gold/40 hover:text-forest disabled:opacity-50"
          >
            <RefreshCw size={19} />
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-xl bg-brick/8 px-3 py-2.5 text-[12.5px] leading-relaxed text-brick ring-1 ring-brick/20"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : (
          <p className="mt-3 text-center text-[12px] leading-relaxed text-clay">{t("auth.captcha.dialogHint")}</p>
        )}
      </form>
    </AlertShell>
  );
}
