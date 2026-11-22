import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  IdCard,
  LifeBuoy,
  ListOrdered,
  Lock,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LoginRole } from "../../../types/enums";
import { HELP, ROLES } from "../../../config/roles.config";
import { useBodyScrollLock } from "../../../hooks/use-body-scroll-lock";
import studentCardSample from "../../../assets/student-card-sample.webp";
import i18n from "../../../i18n/i18n";
import { CODE, ZOOM, useLoginTutorial, type Frame, type LoginTutorial, type SceneKey, type Target } from "../lib/login-tutorial";

interface Props {
  role: LoginRole;
  open: boolean;
  onClose: () => void;
}

/** ما يقوله الدليل لكلّ دورٍ بريديّ: نصوص الخطوات ومسمّيات أجزاء البريد. */
const GUIDE: Record<
  "professor" | "admin",
  {
    emailBody: string;
    localLabel: string;
    domainLabel: string;
    passwordBody: string;
    problemBody: string;
    /** رمز التحقّق بخطوتين بعد كلمة المرور — للمسؤول، وهو مفروضٌ عليه. */
    codeBody?: string;
  }
> = {
  professor: {
    emailBody: "auth.guide.professorEmail",
    localLabel: "auth.guide.professorLocal",
    domainLabel: "auth.guide.universityDomain",
    passwordBody: "auth.guide.professorPassword",
    problemBody: "auth.guide.professorProblem",
  },
  admin: {
    emailBody: "auth.guide.adminEmail",
    localLabel: "auth.guide.adminLocal",
    domainLabel: "auth.guide.domain",
    passwordBody: "auth.guide.adminPassword",
    problemBody: "auth.guide.adminProblem",
    codeBody: "auth.guide.adminCode",
  },
};

/**
 * مساعدة الدخول.
 *
 * للأستاذ والمسؤول: شرحٌ متحرّك لنموذج الدخول نفسه — المؤشّر يختار الدور،
 * والبريد يُكتب ثمّ يُفصَّل إلى جزأيه، ثمّ كلمة المرور، ثمّ رمز Google
 * Authenticator للمسؤول — والكاميرا تقترب من موضع كلّ حدث، بأرقامٍ ذهبيّة
 * تقابلها الخطوات بجانبه. رؤيةُ الحقل يُملأ أوضح من وصفه.
 *
 * وللطالب الشرح نفسه برقم تسجيله، وكلمة مروره تُكشف فتُرى صيغتها (تاريخ
 * ميلاده)؛ ومعه ما يحتاجه وحده: أين يجد رقم تسجيله وتاريخ ميلاده على بطاقته.
 */
export function HelpDialog({ role, open, onClose }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const content = HELP[role];
  const { Icon } = ROLES[role];

  return createPortal(
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-100 flex overflow-y-auto bg-[rgba(16,28,24,0.6)] p-4 backdrop-blur-sm animate-[fade_0.2s_both]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative m-auto w-full max-w-[36rem] overflow-hidden rounded-3xl lg:max-w-[62rem] border border-gold/20 bg-cream-card text-forest shadow-[0_40px_100px_-20px_rgba(16,28,24,0.6)] animate-[fadeUp_0.25s_both]"
      >
        {/* ── الرأس ── */}
        <div className="forest-glow relative overflow-hidden px-6 py-5 lg:px-8 lg:py-6">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />
          <div className="pointer-events-none absolute -top-16 end-10 size-40 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold-soft to-gold lg:size-14 text-[#1a312d] shadow-[0_10px_28px_rgba(193,150,90,0.35)]">
              <Icon size={22} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <h3
                id={titleId}
                className="font-display text-[19px] font-bold text-cream lg:text-[23px]"
              >
                {t(content.titleKey)}
              </h3>
              <p className="mt-0.5 text-[12.5px] text-cream/65">
                {t("auth.guide.subtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("admin.close")}
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/15 text-cream/75 transition hover:bg-white/10 hover:text-cream"
            >
              <X size={18} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-l from-gold/0 via-gold to-gold/0" />
        </div>

        {/* ── المتن ── */}
        <div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-5 py-5 sm:px-6 lg:px-8 lg:py-7">
          {role === "student" ? <StudentGuide /> : <LoginGuide role={role} />}
        </div>

        {/* ── التذييل ── */}
        <div className="flex justify-center border-t border-forest/10 bg-cream-2/60 px-5 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl lg:w-auto lg:min-w-72 lg:px-12 bg-linear-to-br from-gold to-gold-soft py-3 text-sm font-bold text-[#1a312d] shadow-[0_10px_24px_-8px_rgba(193,150,90,0.6)] transition hover:-translate-y-px hover:brightness-105"
          >
            {t("auth.understood")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────────────── الأستاذ والمسؤول ─────────────────────────── */

function LoginGuide({ role }: { role: "professor" | "admin" }) {
  const { t } = useTranslation();
  const cfg = ROLES[role];
  const g = GUIDE[role];
  const roleName = t(cfg.labelKey);

  // المثال هو نفسه ما يقترحه حقل الدخول، مقسوماً عند «@».
  const example = t(cfg.placeholderKey);
  const at = example.indexOf("@");
  const tut = useLoginTutorial({ role: true, code: !!g.codeBody, reveal: false, idLen: example.length, passwordLen: 8 });

  const steps: { n: number; title: string; body: string }[] = [
    {
      n: 1,
      title: t("auth.guide.chooseRole", { role: roleName }),
      body: t("auth.guide.chooseRoleBody"),
    },
    { n: 2, title: t(cfg.fieldLabelKey), body: t(g.emailBody) },
    { n: 3, title: t("admin.password"), body: t(g.passwordBody) },
    ...(g.codeBody ? [{ n: 4, title: t("auth.twoFactor.title"), body: t(g.codeBody) }] : []),
  ];

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-7 lg:space-y-0">
      <TutorialFigure
        tut={tut}
        role={role}
        id={{
          parts:
            at > 0
              ? [
                  { text: example.slice(0, at), label: t(g.localLabel), tone: "forest" },
                  { text: example.slice(at), label: t(g.domainLabel), tone: "gold" },
                ]
              : [{ text: example, label: "", tone: "forest" }],
        }}
      />

      <div className="space-y-5">
        <Steps steps={steps} active={tut.frame.step} onPick={tut.jump} />
        <ProblemBox title={t("auth.signInProblem")} body={t(g.problemBody)} />
      </div>
    </div>
  );
}

/**
 * الخطوات مرقّمةً بالأرقام الذهبية نفسها التي في الصورة. ومع الشرح المتحرّك
 * تُضاء الخطوة الجارية، والنقر على خطوةٍ يأخذ الشرح إليها.
 */
function Steps({
  steps,
  active = null,
  onPick,
}: {
  steps: { n: number; title: string; body: string }[];
  active?: number | null;
  onPick?: (n: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="mb-3.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold">
        <ListOrdered size={14} />
        {t("auth.guide.stepsTitle")}
      </p>
      <ol className={onPick ? "-mx-2 space-y-1.5" : "space-y-4"}>
        {steps.map((s) => {
          const body = (
            <>
              <Badge n={s.n} />
              <div className="min-w-0 pt-0.5">
                <div className="text-[14px] font-bold text-forest">{s.title}</div>
                <p className="mt-0.5 text-[13px] leading-[1.8] text-clay">{s.body}</p>
              </div>
            </>
          );
          return (
            <li key={s.n}>
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(s.n)}
                  aria-current={active === s.n ? "step" : undefined}
                  className={`flex w-full gap-3.5 rounded-2xl p-2 text-start transition duration-300 ${
                    active === s.n ? "bg-gold/10 ring-1 ring-gold/35" : "hover:bg-forest/[0.04]"
                  }`}
                >
                  {body}
                </button>
              ) : (
                <div className="flex gap-3.5">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** «مشكلة في الدخول؟» / «نسيت كلمة المرور؟» — صندوقٌ ذهبيّ آخر الدليل. */
function ProblemBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-gold/30 bg-gold/8 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
        <LifeBuoy size={18} />
      </span>
      <div>
        <div className="text-[13.5px] font-bold text-forest">{title}</div>
        <p className="mt-0.5 text-[12.5px] leading-[1.8] text-clay">{body}</p>
      </div>
    </div>
  );
}

/** رقم الخطوة — ذهبيّ، نفسه في الصورة وفي القائمة. */
function Badge({ n, small = false }: { n: number; small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-linear-to-br from-gold-soft to-gold font-bold text-[#1a312d] shadow-[0_4px_12px_rgba(193,150,90,0.45)] ring-2 ring-cream-card ${
        small ? "size-5 text-[10.5px]" : "size-7 text-[13px]"
      }`}
    >
      {n}
    </span>
  );
}

/** موضع عنصرٍ من المسرح بلا أثرٍ للتكبير: `offset*` لا تتأثّر بـ`transform`. */
function boxIn(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== root) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** ما يبقى حول المنطقة المكبّرة من فراغ، بنقاط المسرح. */
const EDGE = 12;

/**
 * ما يُكتب في حقل التعريف، أجزاءً بالترتيب: لكلٍّ لونه، واسمٌ تحت قوسه
 * يظهر حين يُكتب كلّه — البريد اسماً ونطاقاً، ورقم التسجيل قطعةً واحدة.
 */
interface IdSample {
  parts: { text: string; label: string; tone: Tone }[];
  /** أرقامٌ تُقرأ خانةً خانة. */
  mono?: boolean;
}

/** الشرح المتحرّك في إطاره: المسرح، وتحته أزراره وما يجري الآن. */
function TutorialFigure({
  tut,
  role,
  id,
  password = null,
  captions,
}: {
  tut: LoginTutorial;
  role: LoginRole;
  id: IdSample;
  password?: string | null;
  captions?: Partial<Record<SceneKey, string>>;
}) {
  const { t } = useTranslation();
  const stepOf = (k: SceneKey) => tut.scenes.find((s) => s.key === k)?.step ?? null;
  return (
    <figure className="relative overflow-hidden rounded-2xl border border-forest/10 bg-cream-2 p-4 sm:p-5">
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
      <figcaption className="relative mb-3.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold">
        <ScanSearch size={14} />
        {t("auth.guide.illustration")}
      </figcaption>
      <TutorialStage
        role={role}
        id={id}
        password={password}
        steps={{ role: stepOf("role"), id: stepOf("id")!, password: stepOf("password")!, code: stepOf("code") }}
        frame={tut.frame}
      />
      <TutorialControls tut={tut} role={t(ROLES[role].labelKey)} captions={captions} />
    </figure>
  );
}

/**
 * نموذج الدخول مصغَّراً، يُملأ أمام العين كما في مقاطع الشرح: مؤشّرٌ ينقر،
 * وحروفٌ تُكتب، وكاميرا تقترب من موضع الحدث ثمّ تبتعد. وللمسؤول بعده شاشة
 * الرمز: الهاتف وفيه Google Authenticator، والرمز يُنقل منه.
 *
 * صورةٌ لا حقول: زخرفيّ لقارئ الشاشة (`aria-hidden`)، والخطوات بجانبه تقول
 * الشيء نفسه نصّاً.
 */
function TutorialStage({
  role,
  id,
  password,
  steps,
  frame,
}: {
  role: LoginRole;
  id: IdSample;
  /** كلمة المرور كما تظهر حين تُكشف؛ ولا تُكشف إن لم تُعطَ. */
  password: string | null;
  /** رقم كلّ جزءٍ من النموذج في الدليل؛ وما لا خطوة له بلا رقم (`null`). */
  steps: { role: number | null; id: number; password: number; code: number | null };
  frame: Frame;
}) {
  const { t } = useTranslation();
  const cfg = ROLES[role];
  const FieldIcon = cfg.FieldIcon;
  const canvas = useRef<HTMLDivElement>(null);
  const pointer = useRef<HTMLSpanElement>(null);
  const { focus, cursor, screen } = frame;

  // الكاميرا والمؤشّر من مواضع العناصر؛ والحركة نفسها انتقالٌ في CSS.
  useLayoutEffect(() => {
    const place = () => {
      const cv = canvas.current;
      if (!cv) return;
      const spot = (k: Target) => cv.querySelector<HTMLElement>(`[data-spot="${k}"]`);
      const W = cv.offsetWidth;
      const H = cv.offsetHeight;
      const rtl = getComputedStyle(cv).direction === "rtl";
      const el = focus === "all" ? null : spot(focus);
      let s = 1;
      let tx = 0;
      let ty = 0;
      if (el) {
        const b = boxIn(el, cv);
        // تكبيرٌ خفيف، ولا يزيد على ما يُبقي المنطقة كلّها في الإطار؛ إلّا
        // عريضاً يُعلَم أين المهمّ منه (`data-anchor`): الحقل من جهة بدايته،
        // حيث عنوانه وما يُكتب فيه، والزرّ من وسطه حيث كلمته.
        const anchor = el.dataset.anchor;
        const room = anchor ? Infinity : (W - 2 * EDGE) / b.w;
        s = Math.max(1, Math.min(ZOOM[focus], (H - 2 * EDGE) / b.h, room));
        const start = anchor === "start" && b.w * s > W - 2 * EDGE;
        const x = !start ? W / 2 - (b.x + b.w / 2) * s : rtl ? W - EDGE - (b.x + b.w) * s : EDGE - b.x * s;
        // ولا يظهر ما وراء حوافّ النموذج.
        tx = clamp(x, W - W * s, 0);
        ty = clamp(H / 2 - (b.y + b.h / 2) * s, H - H * s, 0);
      }
      cv.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
      const c = cursor === "start" ? null : spot(cursor);
      const p = c ? boxIn(c, cv) : null;
      if (pointer.current) {
        // في الحقل العريض: قرب بدايته، حيث يُكتب؛ وفي غيره: وسطه.
        const inset = p && c?.dataset.anchor === "start" ? Math.min(90, p.w * 0.25) : null;
        const x = !p ? W * 0.3 : inset === null ? p.x + p.w / 2 : rtl ? p.x + p.w - inset : p.x + inset;
        pointer.current.style.left = `${x}px`;
        pointer.current.style.top = `${p ? p.y + p.h * 0.55 : H - 18}px`;
      }
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [focus, cursor, screen]);

  const full = id.parts.map((p) => p.text).join("");
  // ما كُتب حتى الآن، موزّعاً على الأجزاء بألوانها.
  const typed = id.parts.map((p, i) => {
    const from = id.parts.slice(0, i).reduce((n, q) => n + q.text.length, 0);
    return p.text.slice(0, Math.max(0, frame.typed - from));
  });
  const caret = <span className="ms-px inline-block h-4 w-px bg-forest motion-safe:animate-[caretBlink_1s_steps(1)_infinite]" />;
  const box = (on: boolean) => (on ? "border-gold ring-4 ring-gold/15" : "border-forest/15");
  const press = (k: "submit" | "verify") => (frame.pressed === k ? "scale-95 brightness-125" : "");

  return (
    <div
      aria-hidden="true"
      data-testid="login-tutorial"
      data-scene={frame.scene}
      className="relative mx-auto max-w-sm select-none overflow-hidden rounded-2xl border border-forest/10 bg-cream-card shadow-[0_18px_40px_-18px_rgba(26,49,45,0.45)] lg:max-w-md"
    >
      <div
        ref={canvas}
        className="relative origin-top-left p-4 transition-transform duration-[900ms] ease-[cubic-bezier(.65,0,.35,1)] will-change-transform motion-reduce:transition-none"
      >
        <div className="grid">
          {/* شاشة الدخول */}
          <div className={`[grid-area:1/1] transition-opacity duration-500 ${screen === "login" ? "" : "opacity-0"}`}>
            {/* ① الأدوار */}
            <div className="relative mb-4">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-forest/10 bg-cream-2 p-1">
                {(["student", "professor", "admin"] as const).map((k) => {
                  const { Icon, labelKey } = ROLES[k];
                  const on = k === (frame.picked ? role : "student");
                  return (
                    <span
                      key={k}
                      data-spot={k === role ? "roleTab" : undefined}
                      className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] transition duration-300 ${
                        on ? "bg-[var(--t-brand)] font-bold text-[var(--t-on-brand)] shadow-md ring-2 ring-gold/70" : "text-clay"
                      }`}
                    >
                      <Icon size={12} />
                      {t(labelKey)}
                    </span>
                  );
                })}
              </div>
              {steps.role !== null && (
                <span className="absolute -top-2.5 -start-2.5">
                  <Badge n={steps.role} small />
                </span>
              )}
            </div>

            {/* ② حقل التعريف — يُكتب حرفاً حرفاً، ثمّ يُفصَّل إلى جزأيه */}
            <div data-spot="id" data-anchor="start" className={`mb-3 ${id.parts.some((p) => p.label) ? "pb-8" : ""}`}>
              <MockLabel n={steps.id}>{t(cfg.fieldLabelKey)}</MockLabel>
              <div className={`flex items-center gap-2 rounded-lg border-2 bg-cream-2 px-2.5 py-2 transition ${box(frame.field === "id")}`}>
                <FieldIcon size={14} className="shrink-0 text-clay" />
                <span
                  dir="ltr"
                  className={`flex h-5 min-w-0 flex-1 items-center font-semibold ltr:justify-start rtl:justify-end ${
                    id.mono ? "font-mono text-[13px] tracking-wider" : "text-[12.5px]"
                  }`}
                >
                  {id.parts.map((p, i) =>
                    frame.split ? (
                      <IdPart key={i} text={p.text} label={p.label} tone={p.tone} />
                    ) : (
                      <span key={i} className={TEXT[p.tone]}>
                        {typed[i]}
                      </span>
                    ),
                  )}
                  {frame.field === "id" && caret}
                </span>
              </div>
            </div>

            {/* ③ كلمة المرور — وللطالب تُكشف بالعين، فتُرى صيغتها */}
            <div data-spot="password" data-anchor="start" className="mb-4">
              <MockLabel n={steps.password}>{t("admin.password")}</MockLabel>
              <div
                data-spot="reveal"
                className={`flex items-center gap-2 rounded-lg border-2 bg-cream-2 px-2.5 py-2 transition ${box(frame.field === "password" || frame.revealed)}`}
              >
                <Lock size={14} className="shrink-0 text-clay" />
                <span className="flex h-5 min-w-0 flex-1 items-center text-[13px]">
                  {frame.revealed && password ? (
                    <span dir="ltr" className="font-mono font-bold tracking-wider">
                      <span className="text-gold">{password.slice(0, 4)}</span>
                      <span className="text-sage">{password.slice(4)}</span>
                    </span>
                  ) : (
                    <span className="tracking-[0.3em] text-forest/70">{"•".repeat(frame.dots)}</span>
                  )}
                  {frame.field === "password" && caret}
                </span>
                <span data-spot="eye" className={`shrink-0 transition ${frame.revealed ? "text-gold" : "text-clay"}`}>
                  {frame.revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </span>
              </div>
            </div>

            {/* زرّ الدخول */}
            <div
              data-spot="submit"
              data-anchor="middle"
              className={`flex items-center justify-center gap-1.5 rounded-lg bg-[var(--t-brand)] py-2 text-[12px] font-bold text-[var(--t-on-brand)] transition duration-150 ${press("submit")}`}
            >
              <ArrowLeft size={13} className="ltr:rotate-180" />
              {t("auth.signIn")}
            </div>
          </div>

          {/* ④ شاشة الرمز: الهاتف، ثمّ الحقل */}
          {steps.code !== null && (
            <div
              className={`flex flex-col justify-center gap-2.5 transition-opacity duration-500 [grid-area:1/1] ${screen === "code" ? "" : "opacity-0"}`}
            >
              <div data-spot="phone" className="mx-auto w-full max-w-60 rounded-[1.4rem] bg-[#0b1311] p-1.5 shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                <div dir="ltr" className="rounded-[1.1rem] bg-[#16211d] px-3 pt-2 pb-3">
                  <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-white/15" />
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-white/75">
                    <span className="grid size-4 place-items-center rounded bg-sky-400/20 text-sky-300">
                      <ShieldCheck size={10} />
                    </span>
                    Google Authenticator
                  </p>
                  <div className="mt-2 rounded-xl bg-white/[0.06] px-2.5 py-2">
                    <p className="truncate text-[9.5px] text-white/50">Mudhakkirati ({full})</p>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="font-mono text-[19px] font-bold tracking-[0.12em] text-sky-300">
                        {CODE.slice(0, 3)} {CODE.slice(3)}
                      </span>
                      <Timer left={frame.scene === "code" ? 0.8 - frame.progress * 0.3 : 0.5} />
                    </div>
                  </div>
                </div>
              </div>
              <ArrowDown size={16} className="mx-auto text-gold" />
              <div data-spot="code" className="mx-auto w-full max-w-[18rem]">
                <MockLabel n={steps.code}>{t("auth.twoFactor.codeLabel")}</MockLabel>
                <div dir="ltr" className="grid grid-cols-6 gap-1.5">
                  {[...CODE].map((d, i) => {
                    const on = frame.field === "code" && i === frame.digits;
                    return (
                      <span
                        key={i}
                        className={`grid h-9 place-items-center rounded-lg border-2 font-mono text-[15px] font-bold text-gold transition ${
                          on ? "border-gold ring-2 ring-gold/20" : i < frame.digits ? "border-gold/50 bg-gold/8" : "border-forest/15 bg-cream-2"
                        }`}
                      >
                        {i < frame.digits ? d : on ? caret : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div
                data-spot="verify"
                data-anchor="middle"
                className={`flex items-center justify-center gap-1.5 rounded-lg bg-[var(--t-brand)] py-2 text-[12px] font-bold text-[var(--t-on-brand)] transition duration-150 ${press("verify")}`}
              >
                <ShieldCheck size={13} />
                {t("auth.twoFactor.verify")}
              </div>
            </div>
          )}
        </div>

        {/* المؤشّر، وموجة نقرته */}
        <span
          ref={pointer}
          className="pointer-events-none absolute top-0 left-0 z-10 transition-[left,top] duration-700 ease-[cubic-bezier(.65,0,.35,1)] motion-reduce:transition-none"
        >
          {frame.click !== null && <span key={frame.click} className="animate-tap absolute -top-3.5 -left-3.5 size-7 rounded-full bg-gold/50" />}
          <MousePointer2 size={20} className="relative -mt-[3px] -ml-[3px] fill-white text-[#1a312d] drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]" />
        </span>

        {/* تمّ الدخول */}
        {frame.done && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-cream-card/55 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_12px_30px_-8px_rgba(5,150,105,0.6)] motion-safe:animate-[fadeUp_0.35s_both]">
              <CheckCircle2 size={16} />
              {t("auth.tutorial.done")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** ما بقي من عمر الرمز في Google Authenticator. */
function Timer({ left }: { left: number }) {
  const c = 2 * Math.PI * 7;
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90">
      <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
      <circle cx="9" cy="9" r="7" fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeDasharray={c} strokeDashoffset={c * (1 - left)} strokeLinecap="round" />
    </svg>
  );
}

/** تشغيلٌ وإيقاف، وما يجري الآن بكلمات، وشريطٌ لمشاهده، وإعادةٌ من أوّله. */
function TutorialControls({
  tut,
  role,
  captions,
}: {
  tut: LoginTutorial;
  role: string;
  /** نصّ مشهدٍ يختلف باختلاف الدور (رقم التسجيل لا البريد…). */
  captions?: Partial<Record<SceneKey, string>>;
}) {
  const { t } = useTranslation();
  const { frame, scenes, playing } = tut;
  const step = frame.step;
  const caption = captions?.[frame.scene] ?? (frame.scene === "id" ? "email" : frame.scene);
  const toggleLabel = playing ? t("auth.tutorial.pause") : t("auth.tutorial.play");
  return (
    <div className="relative mx-auto mt-3.5 flex max-w-sm items-center gap-3 lg:max-w-md">
      <button
        type="button"
        onClick={tut.toggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        data-testid="tutorial-toggle"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-gold-soft to-gold text-[#1a312d] shadow-[0_6px_16px_-6px_rgba(193,150,90,0.7)] transition hover:brightness-105 active:scale-95"
      >
        {playing ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
      </button>
      <div className="min-w-0 flex-1">
        <p data-testid="tutorial-caption" className="flex min-h-5 items-center gap-1.5 text-[12.5px] font-bold text-forest">
          {step !== null && <Badge n={step} small />}
          <span className="line-clamp-2 leading-snug">{t(`auth.tutorial.${caption}`, { role, action: t("auth.signIn") })}</span>
        </p>
        <div aria-hidden className="mt-2 flex gap-1">
          {scenes.map((s) => (
            <span key={s.key} style={{ flexGrow: s.ms }} className="h-1 basis-0 overflow-hidden rounded-full bg-forest/10">
              <span className="block h-full rounded-full bg-gold" style={{ width: `${clamp((tut.t - s.start) / s.ms, 0, 1) * 100}%` }} />
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={tut.replay}
        aria-label={t("auth.tutorial.replay")}
        title={t("auth.tutorial.replay")}
        className="grid size-8 shrink-0 place-items-center rounded-full border border-forest/15 text-clay transition hover:border-gold/50 hover:text-forest"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );
}

type Tone = "forest" | "gold" | "sage";
const TEXT: Record<Tone, string> = { forest: "text-forest", gold: "text-gold", sage: "text-sage" };
const LINE: Record<Tone, string> = { forest: "text-forest border-forest/45", gold: "text-gold border-gold", sage: "text-sage border-sage" };

/** جزءٌ من حقل التعريف، وتحته قوسٌ باسمه. */
function IdPart({ text, label, tone }: { text: string; label: string; tone: Tone }) {
  if (!text) return null;
  const color = LINE[tone];
  return (
    <span className="relative">
      <span className={TEXT[tone]}>{text}</span>
      {label && (
        <>
          <span
            className={`absolute inset-x-0 top-[calc(100%+11px)] h-1.5 rounded-b border-x border-b ${color}`}
          />
          <span
            dir="auto"
            className={`absolute top-[calc(100%+19px)] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[10px] font-bold tracking-normal ${color}`}
          >
            {label}
          </span>
        </>
      )}
    </span>
  );
}

function MockLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-forest/80">
      <Badge n={n} small />
      {children}
    </div>
  );
}

/* ─────────────────────────────── الطالب ─────────────────────────────── */

/** المثال: رقم التسجيل كما طُبع على صورة البطاقة نفسها (①)، حرفاً بحرف. */
const REG = "2222399XXXXXX";
/** وكلمة المرور تاريخ الميلاد، بصيغته كما على صورة البطاقة نفسها (②). */
const BIRTH = "YYYY/MM/DD";

function StudentGuide() {
  const { t } = useTranslation();
  const tut = useLoginTutorial({
    role: false,
    code: false,
    reveal: true,
    idLen: REG.length,
    passwordLen: BIRTH.length,
  });
  const steps = [
    { n: 1, title: t("pro.regNumber"), body: t("auth.guide.studentReg") },
    { n: 2, title: t("admin.password"), body: t("auth.guide.studentPassword") },
    { n: 3, title: t("auth.signIn"), body: t("auth.guide.studentSignIn") },
  ];

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-7 lg:space-y-0">
      {/* الشرح المتحرّك: رقم التسجيل كما على البطاقة، وكلمة المرور تُكشف */}
      <TutorialFigure
        tut={tut}
        role="student"
        id={{ parts: [{ text: REG, label: t("auth.guide.asOnCard"), tone: "gold" }], mono: true }}
        password={BIRTH}
        captions={{ id: "reg", password: "birth" }}
      />

      <div className="space-y-5">
        <Steps steps={steps} active={tut.frame.step} onPick={tut.jump} />
        <ProblemBox
          title={t("auth.forgotPassword")}
          body={t("auth.helpForgotPassword")}
        />
      </div>

      {/* أين أجده؟ — البطاقة بعلامتيها: ① رقم التسجيل، ② تاريخ الميلاد */}
      <figure className="relative overflow-hidden rounded-2xl border border-forest/10 bg-cream-2 p-4 sm:p-5 lg:col-span-2">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <figcaption className="relative mb-3.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold">
          <IdCard size={14} />
          {t("auth.guide.whereTitle")}
        </figcaption>
        <StudentCardMock />
      </figure>
    </div>
  );
}

/**
 * بطاقة الطالب — صورة قالب بطاقة جامعة الوادي نفسه، وعليها إطاران نابضان:
 * حول رقم التسجيل في أسفلها (①)، وحول تاريخ الميلاد (②) وهو كلمة المرور.
 * فيعرف الطالب بطاقته، ويعرف أين ينظر فيها لكلّ حقل.
 *
 * والمعروضة نسخةٌ بحجم العرض (880 بكسلاً، WebP) لا الأصل: أخفّ على الصفحة،
 * وتكفي للشرح ولا تصلح للطباعة — وصفحة الدخول عامّة. وعليها شارة «نموذج
 * توضيحي» بالعربية كالبطاقة نفسها.
 */
function StudentCardMock() {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto w-full max-w-[28rem] select-none overflow-hidden rounded-[14px] lg:max-w-[34rem] shadow-[0_18px_40px_-18px_rgba(26,49,45,0.55)] ring-1 ring-black/10">
      <img
        src={studentCardSample}
        alt={t("auth.guide.cardAlt")}
        width={880}
        height={554}
        draggable={false}
        className="block h-auto w-full"
      />

      {/* تاريخ الميلاد وحده (لا مكانه) — هو كلمة المرور */}
      <span
        aria-hidden="true"
        className="absolute left-[23.2%] top-[53%] h-[7.3%] w-[16.6%] rounded-md border-2 border-[#d0313f] bg-[#d0313f]/[0.06] shadow-[0_0_0_4px_rgba(208,49,63,0.15)] motion-safe:animate-[pulseSoft_2.4s_ease-in-out_infinite]"
      />
      <span aria-hidden="true" className="absolute left-[17.6%] top-[53.3%]">
        <Badge n={2} small />
      </span>

      {/* رقم التسجيل — أسفل اليسار، كما يُطبع */}
      <span
        aria-hidden="true"
        className="absolute left-[5.2%] top-[88.3%] h-[7.6%] w-[21.6%] rounded-md border-2 border-dashed border-[#d0313f] bg-[#d0313f]/[0.06] shadow-[0_0_0_4px_rgba(208,49,63,0.15)] motion-safe:animate-[pulseSoft_2.4s_ease-in-out_infinite]"
      />
      <span aria-hidden="true" className="absolute left-[28.2%] top-[88.6%]">
        <Badge n={1} small />
      </span>

      {/* نموذجٌ لا بطاقة */}
      <span
        aria-hidden="true"
        className="absolute bottom-[3.6%] right-[5%] rounded-full bg-[#141c1a]/80 px-2 py-0.5 text-[10px] font-bold text-white"
      >
        {i18n.getFixedT("ar")("auth.guide.card.sample")}
      </span>
    </div>
  );
}
