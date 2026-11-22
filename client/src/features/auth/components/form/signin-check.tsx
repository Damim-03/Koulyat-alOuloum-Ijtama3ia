import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, ScanEye, ShieldCheck } from "lucide-react";
import type {} from "altcha/types/react";
import { env } from "../../../../config/env";
import { ImageCheckDialog } from "./image-check-dialog";

/**
 * التحقّق القصير قبل الدخول (ALTCHA).
 *
 * لا يظهر إلا حين يطلبه الخادم (Backend modules/auth/captcha)، وعلى درجتين:
 *
 * - **المسألة** (`work`) بعد خطأين على الحساب نفسه: أداة ALTCHA في مكانها،
 *   يحلّها المتصفّح نحو ثانية، وحده، بلا صور ولا نافذة؛
 * - **والصورة** (`image`) حين يكون أمرٌ مريب قائماً — إنذار الفشل الجماعي،
 *   أو حسابٌ أُقفل اليوم: نافذةٌ من نوافذ المنصّة (ImageCheckDialog) فيها
 *   رمزٌ يُكتب، والمسألة تُحلّ خلفها. كانت فقاعة الأداة نفسها، تنفتح فوق حقلي
 *   الرقم وكلمة المرور.
 *
 * ولا طرف ثالث: التحدّي والصورة من خادم الجامعة، والحلّ إليه. ومن أدخل كلمة
 * مروره صحيحةً من أوّل مرّة لا يراه أبداً.
 */
export function SignInCheck({
  level,
  onVerified,
  onReset,
  onCancel,
  waiting,
}: {
  /** ما طلبه الخادم: المسألة وحدها، أو ومعها رمز الصورة. */
  level: "work" | "image";
  /** الحلّ (أو التصريح)، يُرسل مع الدخول التالي. */
  onVerified: (payload: string) => void;
  /** الحلّ انتهى أو تعذّر: لا يُرسل. */
  onReset: () => void;
  /** أُغلقت نافذة الصورة بلا رمز: الدخول المنتظَر لا يُرسل. */
  onCancel: () => void;
  /** ضُغط «دخول» والتحقّق لم يكتمل: سيُرسل وحده حين يكتمل. */
  waiting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="signin-check"
      className="mb-4 rounded-xl border border-gold/30 bg-gold/8 p-3 animate-[fadeUp_0.3s_both]"
    >
      <p className="mb-2.5 flex items-start gap-2 text-[12px] leading-[1.7] text-forest/85">
        <ShieldCheck size={15} className="mt-0.5 flex-none text-gold" />
        {t(level === "image" ? "auth.captcha.leadImage" : "auth.captcha.lead")}
      </p>
      {level === "image" ? (
        <ImageCheck onPass={onVerified} onCancel={onCancel} waiting={waiting} />
      ) : (
        <WorkWidget onVerified={onVerified} onReset={onReset} />
      )}
      {waiting && <p className="mt-2 text-[11.5px] text-clay">{t("auth.captcha.waiting")}</p>}
    </div>
  );
}

/**
 * الصورة: زرٌّ يفتح النافذة — وتنفتح وحدها حين يُنتظر الدخول، فمن ضغط «دخول»
 * يرى ما يُطلب منه في الحال. وبعد الرمز الصحيح يقول الصندوق إنّه تمّ.
 */
function ImageCheck({
  onPass,
  onCancel,
  waiting,
}: {
  onPass: (pass: string) => void;
  onCancel: () => void;
  waiting: boolean;
}) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [passed, setPassed] = useState(false);

  return (
    <>
      {passed ? (
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-sage">
          <CheckCircle2 size={16} />
          {t("auth.captcha.passed")}
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setOpened(true)}
          data-testid="image-check-start"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-forest/15 bg-cream-card px-4 py-2.5 text-[13px] font-bold text-forest transition hover:border-gold/45 hover:bg-gold/5"
        >
          <ScanEye size={16} className="text-gold" />
          {t("auth.captcha.start")}
        </button>
      )}
      {!passed && (opened || waiting) && (
        <ImageCheckDialog
          onClose={() => {
            setOpened(false);
            onCancel();
          }}
          onPass={(pass) => {
            setOpened(false);
            setPassed(true);
            onPass(pass);
          }}
        />
      )}
    </>
  );
}

// ─── The proof of work alone: the ALTCHA widget in place ─────

const LANGS: Record<string, () => Promise<unknown>> = {
  ar: () => import("altcha/i18n/ar"),
  fr: () => import("altcha/i18n/fr-fr"),
};

/** أسماء اللغات في سجلّ الأداة: الفرنسية فيه «fr-fr». */
const CODES: Record<string, string> = { ar: "ar", fr: "fr-fr", en: "en" };

/**
 * The "external" build of the widget, its worker a file of this site.
 *
 * The default build starts its proof-of-work worker from a `blob:` address,
 * and the site's policy (`script-src 'self'`, no `worker-src`) refuses it: in
 * production the check failed every time, and development, which sends no
 * policy, never showed it. Here Vite emits the worker as a file served from
 * this origin, and the widget's stylesheet as a file too (the default build
 * writes it into a <style> of its own). Only the algorithm the server asks
 * for (Backend modules/auth/captcha) is registered.
 */
const loadWidget = async () => {
  const [, , { default: Pbkdf2Worker }] = await Promise.all([
    import("altcha/external"),
    import("altcha/altcha.css"),
    import("altcha/workers/pbkdf2?worker"),
  ]);
  globalThis.$altcha.algorithms.set("PBKDF2/SHA-256", () => new Pbkdf2Worker());
};

let widget: Promise<unknown> | null = null;
/**
 * الأداة مرّةً واحدة، ثمّ نصوص اللغة — والإنجليزية فيها أصلاً. ونصّ الخطأ
 * نصّنا: نصّها «حاول مرة أخرى لاحقاً»، والمربّع يعيد التحقّق في الحال.
 * تُحمَّل عند أوّل ظهورٍ لا مع الصفحة: أغلب من يدخل لا يحتاجها.
 */
const load = async (lang: string, retry: string) => {
  widget ??= loadWidget();
  await widget;
  await LANGS[lang]?.();
  const code = CODES[lang];
  const strings = code ? globalThis.$altcha?.i18n.get(code) : undefined;
  if (code && strings) globalThis.$altcha.i18n.set(code, { ...strings, error: retry });
};

/** ألوان المنصّة على الأداة، فتتبع الوضع الداكن والفاتح معاً. */
const THEME = {
  "--altcha-max-width": "100%",
  "--altcha-border-radius": "12px",
  "--altcha-border-color": "color-mix(in oklab, var(--color-forest) 15%, transparent)",
  "--altcha-color-base": "var(--color-cream-card)",
  "--altcha-color-base-content": "var(--color-forest)",
  "--altcha-color-primary": "var(--color-sage)",
  "--altcha-color-success": "var(--color-sage)",
  "--altcha-color-error": "var(--color-brick)",
  "--altcha-checkbox-border-radius": "6px",
} as CSSProperties;

function WorkWidget({ onVerified, onReset }: { onVerified: (payload: string) => void; onReset: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.split("-")[0] ?? "ar";
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    void load(lang, t("auth.captcha.retry")).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [lang, t]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const verified = (e: Event) => onVerified((e as CustomEvent<{ payload: string }>).detail.payload);
    const changed = (e: Event) => {
      const state = (e as CustomEvent<{ state: string }>).detail.state;
      if (state === "expired" || state === "error") onReset();
    };
    el.addEventListener("verified", verified);
    el.addEventListener("statechange", changed);
    return () => {
      el.removeEventListener("verified", verified);
      el.removeEventListener("statechange", changed);
    };
  }, [ready, onVerified, onReset]);

  return ready ? (
    <altcha-widget
      ref={ref}
      challenge={`${env.VITE_API_URL}/auth/challenge`}
      auto="onload"
      language={lang}
      configuration={JSON.stringify({ hideFooter: true, hideLogo: true })}
      style={THEME}
    />
  ) : (
    <span className="flex items-center gap-2 text-[12px] text-clay">
      <Loader2 size={14} className="animate-spin" />
      {t("auth.captcha.loading")}
    </span>
  );
}
