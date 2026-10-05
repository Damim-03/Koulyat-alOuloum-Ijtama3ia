import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Eye,
  IdCard,
  LifeBuoy,
  ListOrdered,
  Lock,
  MousePointerClick,
  ScanSearch,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LoginRole } from "../../../types/enums";
import { HELP, ROLES } from "../../../config/roles.config";
import { useBodyScrollLock } from "../../../hooks/use-body-scroll-lock";
import studentCardSample from "../../../assets/student-card-sample.webp";
import i18n from "../../../i18n/i18n";

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
  },
};

/**
 * مساعدة الدخول.
 *
 * للأستاذ والمسؤول: صورةٌ مصغّرة لنموذج الدخول نفسه — الدور المختار، والبريد
 * مكتوباً ومفصَّلاً إلى جزأيه، وكلمة المرور — بأرقامٍ ذهبيّة تقابلها الخطوات
 * تحتها. رؤيةُ الحقل كما سيُملأ أوضح من وصفه.
 *
 * وللطالب ما يحتاجه وحده: أين يجد رقم تسجيله على بطاقته، ومِمَّ يتكوّن.
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
  const local = at > 0 ? example.slice(0, at) : example;
  const domain = at > 0 ? example.slice(at) : "";

  const steps: { n: number; title: string; body: string }[] = [
    {
      n: 1,
      title: t("auth.guide.chooseRole", { role: roleName }),
      body: t("auth.guide.chooseRoleBody"),
    },
    { n: 2, title: t(cfg.fieldLabelKey), body: t(g.emailBody) },
    { n: 3, title: t("admin.password"), body: t(g.passwordBody) },
  ];

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-7 lg:space-y-0">
      {/* الصورة التوضيحية */}
      <figure className="relative overflow-hidden rounded-2xl border border-forest/10 bg-cream-2 p-4 sm:p-5">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <figcaption className="relative mb-3.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold">
          <ScanSearch size={14} />
          {t("auth.guide.illustration")}
        </figcaption>
        <LoginMock
          role={role}
          local={local}
          domain={domain}
          localLabel={t(g.localLabel)}
          domainLabel={t(g.domainLabel)}
        />
      </figure>

      <div className="space-y-5">
        <Steps steps={steps} />
        <ProblemBox title={t("auth.signInProblem")} body={t(g.problemBody)} />
      </div>
    </div>
  );
}

/** الخطوات مرقّمةً بالأرقام الذهبية نفسها التي في الصورة. */
function Steps({
  steps,
}: {
  steps: { n: number; title: string; body: string }[];
}) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="mb-3.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold">
        <ListOrdered size={14} />
        {t("auth.guide.stepsTitle")}
      </p>
      <ol className="space-y-4">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3.5">
            <Badge n={s.n} />
            <div className="min-w-0 pt-0.5">
              <div className="text-[14px] font-bold text-forest">{s.title}</div>
              <p className="mt-0.5 text-[13px] leading-[1.8] text-clay">
                {s.body}
              </p>
            </div>
          </li>
        ))}
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

/**
 * نموذج الدخول مصغَّراً — صورةٌ لا حقول: زخرفيّ لقارئ الشاشة (`aria-hidden`)،
 * والخطوات تحته تقول الشيء نفسه نصّاً.
 */
function LoginMock({
  role,
  local,
  domain,
  localLabel,
  domainLabel,
}: {
  role: "professor" | "admin";
  local: string;
  domain: string;
  localLabel: string;
  domainLabel: string;
}) {
  const { t } = useTranslation();
  const cfg = ROLES[role];
  const FieldIcon = cfg.FieldIcon;

  return (
    <div
      aria-hidden="true"
      className="relative mx-auto max-w-sm select-none rounded-2xl border lg:max-w-md border-forest/10 bg-cream-card p-4 shadow-[0_18px_40px_-18px_rgba(26,49,45,0.45)]"
    >
      {/* ① الأدوار */}
      <div className="relative mb-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-forest/10 bg-cream-2 p-1">
          {(["student", "professor", "admin"] as const).map((k) => {
            const { Icon, labelKey } = ROLES[k];
            const on = k === role;
            return (
              <span
                key={k}
                className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] ${
                  on
                    ? "bg-[var(--t-brand)] font-bold text-[var(--t-on-brand)] shadow-md ring-2 ring-gold/70"
                    : "text-clay"
                }`}
              >
                <Icon size={12} />
                {t(labelKey)}
              </span>
            );
          })}
        </div>
        <span className="absolute -top-2.5 -start-2.5">
          <Badge n={1} small />
        </span>
        <MousePointerClick
          size={18}
          className={`absolute -bottom-3 text-gold drop-shadow motion-safe:animate-[floatY_2.4s_ease-in-out_infinite] ${
            role === "professor" ? "left-1/2" : "end-[12%]"
          }`}
        />
      </div>

      {/* ② البريد */}
      <MockLabel n={2}>{t(cfg.fieldLabelKey)}</MockLabel>
      {/* والبريد مفصَّلٌ تحته: قوسٌ تحت كلّ جزءٍ واسمُه — معلّقان بالنصّ نفسه، فيقعان تحته تماماً */}
      <div
        className={`flex items-center gap-2 rounded-lg border-2 border-gold/70 bg-cream-2 px-2.5 py-2 shadow-[0_0_0_4px_rgba(193,150,90,0.15)] ${
          domain ? "mb-10" : "mb-4"
        }`}
      >
        <FieldIcon size={14} className="shrink-0 text-clay" />
        <span
          dir="ltr"
          className="flex min-w-0 flex-1 items-center justify-end text-[12.5px] font-semibold"
        >
          <EmailPart
            text={local}
            label={domain ? localLabel : ""}
            tone="forest"
          />
          <EmailPart text={domain} label={domainLabel} tone="gold" />
          <span className="ms-px h-4 w-px bg-forest motion-safe:animate-[caretBlink_1s_steps(1)_infinite]" />
        </span>
      </div>

      {/* ③ كلمة المرور */}
      <MockLabel n={3}>{t("admin.password")}</MockLabel>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-forest/15 bg-cream-2 px-2.5 py-2">
        <Lock size={14} className="shrink-0 text-clay" />
        <span className="flex-1 text-[13px] tracking-[0.3em] text-forest/70">
          ••••••••
        </span>
        <Eye size={14} className="shrink-0 text-clay" />
      </div>

      {/* زرّ الدخول */}
      <div className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--t-brand)] py-2 text-[12px] font-bold text-[var(--t-on-brand)]">
        <ArrowLeft size={13} className="ltr:rotate-180" />
        {t("auth.signIn")}
      </div>
    </div>
  );
}

function EmailPart({
  text,
  label,
  tone,
}: {
  text: string;
  label: string;
  tone: "forest" | "gold";
}) {
  if (!text) return null;
  const color =
    tone === "gold" ? "text-gold border-gold" : "text-forest border-forest/45";
  return (
    <span className="relative">
      <span className={tone === "gold" ? "text-gold" : "text-forest"}>
        {text}
      </span>
      {label && (
        <>
          <span
            className={`absolute inset-x-0 top-[calc(100%+11px)] h-1.5 rounded-b border-x border-b ${color}`}
          />
          <span
            dir="auto"
            className={`absolute left-1/2 top-[calc(100%+19px)] -translate-x-1/2 whitespace-nowrap text-[10px] font-bold ${color}`}
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

/** المثال: سنة البكالوريا ثمّ رقمها — ويُقرآن معاً رقمَ التسجيل. والرقم بخاناتٍ
 *  مجهولة كما على البطاقة: يُري الشكل لا رقمَ أحد. */
const BAC_YEAR = "2022";
const BAC_NUMBER = "39XXXXXX";

function StudentGuide() {
  const { t } = useTranslation();
  const steps = [
    { n: 1, title: t("pro.regNumber"), body: t("auth.guide.studentReg") },
    { n: 2, title: t("admin.password"), body: t("auth.guide.studentPassword") },
    { n: 3, title: t("auth.signIn"), body: t("auth.guide.studentSignIn") },
  ];

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-start lg:gap-7 lg:space-y-0">
      {/* أين أجده؟ */}
      <figure className="relative overflow-hidden rounded-2xl border border-forest/10 bg-cream-2 p-4 sm:p-5">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <figcaption className="relative mb-3.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-gold">
          <IdCard size={14} />
          {t("auth.guide.whereTitle")}
        </figcaption>
        <StudentCardMock />
      </figure>

      <div className="space-y-5">
        <Steps steps={steps} />
        <ProblemBox
          title={t("auth.forgotPassword")}
          body={t("auth.helpForgotPassword")}
        />
      </div>

      {/* مِمَّ يتكوّن؟ — صفٌّ كامل تحت العمودين: معادلةٌ أفقية تحبّ العرض */}
      <section className="rounded-2xl border border-forest/10 bg-cream-2/60 p-4 sm:p-5 lg:col-span-2 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-7">
        <div className="mb-4 text-center lg:mb-0 lg:max-w-64 lg:text-start">
          <h4 className="text-[13px] font-bold text-forest lg:text-[15px]">
            {t("auth.guide.formulaTitle")}
          </h4>
          <p className="mt-1.5 hidden text-[12px] leading-relaxed text-clay lg:block">
            {t("auth.guide.formulaNote")}
          </p>
        </div>
        <div
          dir="ltr"
          className="flex flex-wrap items-center justify-center gap-2 lg:gap-3"
        >
          <Part
            value={BAC_YEAR}
            label={t("auth.guide.bacYear")}
            digits={4}
            tone="gold"
          />
          <span className="text-lg font-bold text-clay">+</span>
          <Part
            value={BAC_NUMBER}
            label={t("auth.guide.bacNumber")}
            digits={8}
            tone="sage"
          />
          <span className="text-lg font-bold text-clay">=</span>
          <div className="flex flex-col items-center rounded-xl border-2 border-gold/60 bg-cream-card px-3 py-2 shadow-[0_8px_20px_-10px_rgba(193,150,90,0.6)] lg:px-4">
            <span className="font-mono text-[15px] font-bold tracking-wider lg:text-[17px]">
              <span className="text-gold">{BAC_YEAR}</span>
              <span className="text-sage">{BAC_NUMBER}</span>
            </span>
            <span
              dir="auto"
              className="mt-0.5 text-[10.5px] font-semibold text-forest"
            >
              {t("pro.regNumber")} · {t("auth.guide.digits", { count: 12 })}
            </span>
          </div>
        </div>
        <p className="mt-4 text-center text-[12px] leading-relaxed text-clay lg:hidden">
          {t("auth.guide.formulaNote")}
        </p>
      </section>
    </div>
  );
}

/** جزءٌ من المعادلة: الرقم، وما هو، وكم خانةً فيه. */
function Part({
  value,
  label,
  digits,
  tone,
}: {
  value: string;
  label: string;
  digits: number;
  tone: "gold" | "sage";
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-col items-center rounded-xl border px-3 py-2 ${
        tone === "gold"
          ? "border-gold/40 bg-gold/10"
          : "border-sage/40 bg-sage/10"
      }`}
    >
      <span
        className={`font-mono text-[15px] font-bold tracking-wider ${tone === "gold" ? "text-gold" : "text-sage"}`}
      >
        {value}
      </span>
      <span
        dir="auto"
        className="mt-0.5 text-[10.5px] font-semibold text-forest"
      >
        {label}
      </span>
      <span dir="auto" className="text-[9.5px] text-clay">
        {t("auth.guide.digits", { count: digits })}
      </span>
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
    <div className="relative mx-auto w-full max-w-[28rem] select-none overflow-hidden rounded-[14px] lg:max-w-none shadow-[0_18px_40px_-18px_rgba(26,49,45,0.55)] ring-1 ring-black/10">
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
