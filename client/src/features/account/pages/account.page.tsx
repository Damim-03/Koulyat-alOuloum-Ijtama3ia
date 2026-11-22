import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { RecoveryEmailCard } from "../components/recovery-email-card";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AtSign,
  Award,
  CheckCircle2,
  Pencil,
  Plus,
  Send,
  X,
  BadgeCheck,
  Building2,
  CalendarRange,
  GraduationCap,
  IdCard,
  MessageSquare,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Fingerprint,
  Globe,
  ImagePlus,
  KeyRound,
  Languages,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  Monitor,
  MonitorSmartphone,
  Moon,
  Palette,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Sun,
  Tablet,
  Trash2,
  TriangleAlert,
  Upload,
  User,
  UserRound,
  type LucideIcon,
  ImageMinus,
} from "lucide-react";
import type { AccountSession, MyAccount, MyAccountPatch } from "../../../types/account";
import {
  useChangeMyEmail,
  useEndMySession,
  useMyAccount,
  useMyActivationRequest,
  useMySessions,
  useSetMyAvatar,
  useUpdateMyAccount,
} from "../account.api";
import { VerificationWing } from "../components/activation-screen";
import { useDates } from "../../../hooks/use-dates";
import { useAuth } from "../../../hooks/use-auth";
import { useLanguage } from "../../../hooks/use-language";
import { useTheme } from "../../../hooks/use-theme";
import { UserAvatar } from "../../../components/ui/user-avatar";
import { LoadingArea } from "../../../components/ui/loading-area";
import { ErrorRetry } from "../../../components/ui/error-retry";
import { ImageCropperDialog } from "../../admin/components/ui/image-cropper-dialog";
import { GenderSelect } from "../../admin/components/ui/gender-select";
import { ConfirmDialog } from "../../admin/components/form/confirm-dialog.form";
import { LATIN_NAME, toLatinFirst, toLatinLast } from "../../../lib/latin-name";
import { relative } from "../../admin/pages/projects/project-utils";
import i18n from "../../../i18n/i18n";
import { otherScriptName, personName, readsLatin } from "../../../lib/person-name";
import { Field, PrimaryBtn, Secret } from "../components/form-bits";
import { inputCls } from "../lib/input-class";
import { PasswordForm } from "../components/password-form";
import { TwoFactorCard } from "../components/two-factor-card";

/**
 * The administrator's own account, from A to Z — one wing at a time.
 *
 * Each wing holds one concern: who you are, your photo, the email you sign in
 * with, your password, your sessions, your preferences. Picking a wing opens
 * it alone, and the address remembers which (`?tab=`), so a link — the
 * account menu's "change password" — can open the right one directly.
 */

const WINGS = ["personal", "verification", "photo", "email", "password", "security", "prefs"] as const;
type Wing = (typeof WINGS)[number];
const WING_ICON: Record<Wing, LucideIcon> = {
  personal: UserRound,
  // A student's own: the card and the face, sent for the administration to verify.
  verification: BadgeCheck,
  photo: Camera,
  email: Mail,
  password: KeyRound,
  security: ShieldCheck,
  prefs: Palette,
};

const USERNAME = /^[A-Za-z0-9._-]{3,30}$/;
const PHONE = /^\+?[0-9][0-9 ]{5,19}$/;
const COMPLETENESS: (keyof MyAccount)[] = ["firstName", "lastName", "firstNameLatin", "lastNameLatin", "gender", "phone", "username", "avatarUrl"];
const CARD = "rounded-3xl border border-forest/10 bg-cream-card shadow-[0_4px_20px_rgba(38,66,61,0.05)]";

export function AccountPage() {
  const q = useMyAccount();
  if (q.isLoading) return <LoadingArea className="py-24" />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => q.refetch()} />;
  // Keyed on the last save, so every form starts again from what was stored.
  return <Account a={q.data} key={q.data.updatedAt} />;
}

function Account({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  // Only the wings this role can use: no photo wing for a student, no email
  // wing for anyone but the administration, and verification by photos for
  // students alone.
  const isStudent = a.role === "student";
  // A student's or a professor's own email is set in the personal wing — the «email» wing speaks
  // of signing in by it, which only an administrator does.
  const wings = WINGS.filter(
    (w) => (w !== "photo" || a.can.photo) && (w !== "email" || (a.can.email && a.role === "admin")) && (w !== "verification" || isStudent),
  );
  // Where a request to verify the account stands — read only where it can be one.
  const request = useMyActivationRequest(isStudent && !a.isVerified).data;
  const wing: Wing = (wings as readonly string[]).includes(sp.get("tab") ?? "") ? (sp.get("tab") as Wing) : "personal";
  const open = (w: Wing) => {
    const next = new URLSearchParams(sp);
    if (w === "personal") next.delete("tab");
    else next.set("tab", w);
    setSp(next, { replace: true });
  };

  const { currentLang, languages } = useLanguage();
  const { theme } = useTheme();
  // Only what this role can fill in counts: a professor has no username to
  // set, and a student fills in nothing — so no score at all.
  const fields = COMPLETENESS.filter((k) => (k === "avatarUrl" ? a.can.photo : a.can.edit.includes(k)));
  const done = fields.filter((k) => !!a[k]).length;
  const pct = fields.length ? Math.round((done / fields.length) * 100) : null;

  const status: Record<Wing, { text: string; tone: "ok" | "warn" | "muted" }> = {
    personal:
      pct === null
        ? { text: t("admin.account.wing.readOnly"), tone: "muted" }
        : { text: pct === 100 ? t("admin.account.wing.complete") : t("admin.account.wing.percent", { p: pct }), tone: pct === 100 ? "ok" : "warn" },
    verification: a.isVerified
      ? { text: t("admin.struct.spec.verified"), tone: "ok" }
      : request?.status === "pending"
        ? { text: t("admin.account.wing.verifyPending"), tone: "warn" }
        : request?.status === "rejected"
          ? { text: t("admin.account.wing.verifyRejected"), tone: "warn" }
          : { text: t("admin.account.security.notVerified"), tone: "muted" },
    photo: { text: a.avatarUrl ? t("admin.account.wing.photoSet") : t("admin.account.wing.photoNone"), tone: a.avatarUrl ? "ok" : "warn" },
    email: { text: a.email ?? "—", tone: "muted" },
    password: { text: t("admin.account.wing.protected"), tone: "ok" },
    security:
      a.twoFactor.available && !a.twoFactor.enabled
        ? { text: t("account.twoFactor.off"), tone: "warn" }
        : { text: t(`admin.struct.spec.status.${a.status === "suspended" ? "suspended" : "active"}`), tone: a.status === "suspended" ? "warn" : "ok" },
    prefs: { text: `${languages.find((l) => l.code === currentLang)?.label ?? currentLang} · ${t(`admin.account.prefs.theme_${theme}`)}`, tone: "muted" },
  };

  const index = wings.indexOf(wing);
  const prev = index > 0 ? wings[index - 1] : null;
  const next = index < wings.length - 1 ? wings[index + 1] : null;
  const Icon = WING_ICON[wing];

  return (
    <div className="font-body">
      <Hero a={a} pct={pct} missing={fields.length - done} onPhoto={a.can.photo ? () => open("photo") : undefined} onComplete={() => open("personal")} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ── the wings ── */}
        <nav aria-label={t("admin.account.sections")} className={`${CARD} top-20 p-2.5 lg:sticky`}>
          <p className="hidden px-3 pt-2 pb-3 text-[11px] font-bold tracking-wide text-gold lg:block">{t("admin.account.wings")}</p>
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1" role="tablist">
            {wings.map((w) => {
              const on = w === wing;
              const WIcon = WING_ICON[w];
              const s = status[w];
              return (
                <button
                  key={w}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls="account-wing"
                  data-testid={`wing-${w}`}
                  onClick={() => open(w)}
                  className={`group relative flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-start transition duration-300 lg:w-full ${
                    on
                      ? "bg-linear-to-l from-gold/20 via-gold/10 to-transparent shadow-[inset_0_0_0_1px_rgba(193,150,90,0.4)]"
                      : "hover:bg-forest/[0.04]"
                  }`}
                >
                  {on && <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-gold" />}
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-xl transition duration-300 ${
                      on ? "bg-linear-to-br from-gold to-gold-soft text-forest-deep shadow-[0_8px_18px_-8px_rgba(193,150,90,0.8)]" : "bg-forest/6 text-forest group-hover:bg-gold/12 group-hover:text-gold"
                    }`}
                  >
                    <WIcon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13.5px] font-bold ${on ? "text-forest" : "text-forest/85"}`}>{t(`admin.account.section.${w}`)}</span>
                    <span
                      dir={w === "email" ? "ltr" : undefined}
                      className={`mt-0.5 flex items-center gap-1 truncate text-[11px] ${
                        s.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : s.tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-clay"
                      } ${w === "email" ? "justify-end" : ""}`}
                    >
                      {s.tone === "ok" && <Check size={11} className="shrink-0" />}
                      <span className="truncate">{s.text}</span>
                    </span>
                  </span>
                  <ChevronLeft size={16} className={`hidden shrink-0 transition lg:block ltr:rotate-180 ${on ? "text-gold" : "text-clay/40 group-hover:text-clay"}`} />
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── the open wing ── */}
        <section id="account-wing" role="tabpanel" className={`${CARD} min-w-0 overflow-hidden`}>
          <header className="relative overflow-hidden border-b border-forest/8 px-6 py-6 lg:px-8">
            <div className="dot-matrix pointer-events-none absolute inset-0 opacity-25" />
            <div className="pointer-events-none absolute -top-16 -start-10 size-56 rounded-full bg-gold/10 blur-3xl" />
            <div className="relative flex flex-wrap items-center gap-4">
              <span className="hidden size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-forest to-forest-deep text-gold-soft shadow-[0_10px_24px_-12px_rgba(22,36,31,0.8)] dark:from-gold/25 dark:to-gold/10 dark:text-gold sm:grid">
                <Icon size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-wide text-gold">{t("admin.account.wingOf", { n: index + 1, total: wings.length })}</p>
                <h2 className="font-serif text-[22px] leading-tight font-bold text-forest">{t(`admin.account.section.${wing}`)}</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-clay">{t(wing === "personal" && a.role !== "admin" ? `admin.account.wingHint.personal_${a.role}` : `admin.account.wingHint.${wing}`)}</p>
              </div>
            </div>
          </header>

          <div className="animate-scale-in px-6 py-6 lg:px-8" key={wing}>
            {wing === "personal" && (isStudent || !a.can.edit.length ? <ProfileWing a={a} /> : <PersonalWing a={a} />)}
            {wing === "verification" && <VerificationWing verified={a.isVerified} />}
            {wing === "photo" && <PhotoWing a={a} />}
            {wing === "email" && <EmailWing a={a} />}
            {wing === "password" && <PasswordForm a={a} />}
            {wing === "security" && <SecurityWing a={a} />}
            {wing === "prefs" && <PrefsWing />}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-forest/8 bg-cream-2/30 px-6 py-4 lg:px-8">
            {prev ? (
              <button type="button" onClick={() => open(prev)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-clay transition hover:bg-forest/5 hover:text-forest">
                <ChevronRight size={15} className="ltr:rotate-180" />
                {t(`admin.account.section.${prev}`)}
              </button>
            ) : (
              <span />
            )}
            {next && (
              <button type="button" onClick={() => open(next)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-gold transition hover:bg-gold/10">
                {t(`admin.account.section.${next}`)}
                <ChevronLeft size={15} className="ltr:rotate-180" />
              </button>
            )}
          </footer>
        </section>
      </div>
    </div>
  );
}


/* ── hero ─────────────────────────────────────────────────── */

function Hero({ a, pct, missing, onPhoto, onComplete }: { a: MyAccount; pct: number | null; missing: number; onPhoto?: () => void; onComplete: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  // The name in the interface's script on top, the other script beneath it.
  const name = personName(a) || a.email || "—";
  const other = otherScriptName(a);
  const otherIsLatin = !readsLatin();

  return (
    <section className="forest-glow relative mb-6 overflow-hidden rounded-3xl px-5 py-7 text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)] sm:px-6 sm:py-8 lg:px-10">
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-24 -end-16 size-96 rounded-full bg-gold/12 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 start-1/3 size-72 rounded-full bg-soft-sage/10 blur-3xl" />
      {/* A phone stacks it — photo, then the name centred under it; beside a
          116px photo the name had a column some 150px wide. */}
      <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:flex-wrap sm:gap-7 sm:text-start">
        <div className="relative">
          <span className="absolute -inset-2 rounded-full bg-linear-to-br from-gold/60 via-gold/10 to-transparent blur-[2px]" />
          <UserAvatar user={a} size={116} className="relative ring-4 ring-forest-deep" />
{onPhoto && (
          <button
            type="button"
            onClick={onPhoto}
            aria-label={t("admin.account.photo.change")}
            className="absolute -bottom-0.5 -end-0.5 grid size-10 place-items-center rounded-full border-[3px] border-forest-deep bg-gold text-forest-deep shadow-lg transition hover:scale-105 hover:bg-gold-soft"
          >
            <Camera size={17} />
          </button>
          )}
        </div>

        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-gold-soft">
            <Sparkles size={12} />
            {t("admin.account.eyebrow")}
          </p>
          <h1 className="font-serif text-[28px] leading-tight font-bold text-cream lg:text-[34px]">
            <bdi>{name}</bdi>
          </h1>
          {other && (
            <p className="mt-2 flex items-center justify-center gap-3 sm:justify-start" data-testid="hero-other-name">
              <span aria-hidden className="h-px w-10 shrink-0 bg-linear-to-l from-gold/10 to-gold ltr:bg-linear-to-r" />
              {/* Letter-spacing suits Latin capitals; it would break Arabic apart. */}
              <bdi className={`text-[18px] leading-none text-gold-soft ${otherIsLatin ? "font-serif font-semibold tracking-[0.12em]" : "font-semibold"}`}>{other}</bdi>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12px] sm:justify-start">
            {a.email && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(a.email ?? "").then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-cream/10 px-3 py-1.5 text-cream/90 backdrop-blur-sm transition hover:bg-cream/20"
                title={t("common.copy")}
              >
                <Mail size={12} className="text-gold-soft" />
                <span dir="ltr" className="min-w-0 break-all">{a.email}</span>
                {copied ? <Check size={12} className="text-emerald-300" /> : <Copy size={11} className="text-cream/60" />}
              </button>
            )}
            <span className="rounded-full bg-linear-to-l from-gold to-gold-soft px-3 py-1.5 font-bold text-forest-deep">{t(`roles.${a.role}`, { defaultValue: a.role })}</span>
            {a.isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-400/15 px-3 py-1.5 text-sky-100">
                <BadgeCheck size={13} />
                {t("admin.struct.spec.verified")}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-[12px] sm:justify-start">
            <HeroFact icon={Clock} label={t("admin.account.lastLogin")} value={a.lastLoginAt ? relative(a.lastLoginAt) : "—"} />
            <HeroFact
              icon={User}
              label={t("admin.account.memberSince")}
              value={new Date(a.createdAt).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" })}
            />
          </div>
        </div>

        <div className="flex w-full flex-wrap items-stretch justify-center gap-3 sm:w-auto">
          {(a.student || a.professor) && <IdentityCard a={a} />}
          {pct !== null && (
            <button
              type="button"
              onClick={onComplete}
              className="flex items-center gap-4 rounded-3xl border border-white/10 bg-cream/5 p-4 pe-5 text-start backdrop-blur-sm transition hover:border-gold/40 hover:bg-cream/10"
            >
              <Ring value={pct} />
              <div className="max-w-48">
                <p className="text-[13px] font-bold text-cream">{t("admin.account.completeness")}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-cream/75">{pct === 100 ? t("admin.account.completeAll") : t("admin.account.completeMissing", { count: missing })}</p>
                {pct < 100 && <p className="mt-1 text-[11px] font-semibold text-gold-soft">{t("admin.account.completeNow")}</p>}
              </div>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** One fact under the name: a label, and its value bright enough to read. */
function HeroFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 backdrop-blur-sm">
      <Icon size={13} className="shrink-0 text-gold-soft" />
      <span className="text-cream/70">{label}</span>
      <b className="font-semibold text-cream">{value}</b>
    </span>
  );
}

/* ── personal ─────────────────────────────────────────────── */

type Form = { firstName: string; lastName: string; firstNameLatin: string; lastNameLatin: string; username: string; phone: string; gender: "male" | "female" | null };

/**
 * The names, both scripts, and the contact details — for whoever may change
 * them: an administrator all of it, a professor all but the username. A
 * professor's position stays below, as the administration keeps it.
 */
function PersonalWing({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const update = useUpdateMyAccount();
  const canUsername = a.can.edit.includes("username");
  // الأستاذ كالطالب: الاسم باللاتينية إلزاميّ، والعربيّ اختياريّ.
  const latinFirstRole = a.role === "professor";
  const initial: Form = {
    firstName: a.firstName ?? "",
    lastName: a.lastName ?? "",
    firstNameLatin: a.firstNameLatin ?? "",
    lastNameLatin: a.lastNameLatin ?? "",
    username: a.username ?? "",
    phone: a.phone ?? "",
    gender: a.gender,
  };
  const [f, setF] = useState<Form>(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const errors = useMemo(() => {
    const e: Partial<Record<keyof Form, string>> = {};
    const squash = (s: string) => s.trim().replace(/\s+/g, " ");
    const arabicRequired = !latinFirstRole;
    if (arabicRequired && !f.firstName.trim()) e.firstName = t("admin.account.err.required");
    if (arabicRequired && !f.lastName.trim()) e.lastName = t("admin.account.err.required");
    if (latinFirstRole && !f.firstNameLatin.trim()) e.firstNameLatin = t("admin.account.err.required");
    if (latinFirstRole && !f.lastNameLatin.trim()) e.lastNameLatin = t("admin.account.err.required");
    if (f.firstNameLatin.trim() && !LATIN_NAME.test(squash(f.firstNameLatin))) e.firstNameLatin = t("admin.account.err.latin");
    if (f.lastNameLatin.trim() && !LATIN_NAME.test(squash(f.lastNameLatin))) e.lastNameLatin = t("admin.account.err.latin");
    if (canUsername && f.username.trim() && !USERNAME.test(f.username.trim())) e.username = t("admin.account.err.username");
    if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = t("admin.account.err.phone");
    return e;
  }, [f, t, canUsername, latinFirstRole]);

  const latinFirst = f.firstNameLatin.trim() && !errors.firstNameLatin ? toLatinFirst(f.firstNameLatin) : "";
  const latinLast = f.lastNameLatin.trim() && !errors.lastNameLatin ? toLatinLast(f.lastNameLatin) : "";

  const patch = useMemo(() => {
    const p: MyAccountPatch = {};
    const val = (s: string) => (s.trim() ? s.trim() : null);
    // العربيّ يُمسح (null) حيث هو اختياريّ.
    const arabic = (s: string) => (latinFirstRole ? val(s) : s.trim());
    if (f.firstName.trim() !== (a.firstName ?? "")) p.firstName = arabic(f.firstName);
    if (f.lastName.trim() !== (a.lastName ?? "")) p.lastName = arabic(f.lastName);
    const fl = f.firstNameLatin.trim() ? toLatinFirst(f.firstNameLatin) : "";
    const ll = f.lastNameLatin.trim() ? toLatinLast(f.lastNameLatin) : "";
    if (fl !== (a.firstNameLatin ?? "")) p.firstNameLatin = val(fl);
    if (ll !== (a.lastNameLatin ?? "")) p.lastNameLatin = val(ll);
    if (canUsername && f.username.trim() !== (a.username ?? "")) p.username = val(f.username);
    if (f.phone.trim() !== (a.phone ?? "")) p.phone = val(f.phone);
    if (f.gender !== a.gender) p.gender = f.gender;
    return p;
  }, [f, a, canUsername, latinFirstRole]);
  const changes = Object.keys(patch).length;

  // الأستاذ: اللاتينيّ أوّلاً وهو الإلزاميّ؛ والإداريّ: العربيّ أوّلاً.
  const latinGroup = (
    <Group icon={Globe} title={t("admin.account.group.latin")} hint={t("admin.account.latinHint")}>
      <Field label={t("admin.account.f.firstNameLatin")} error={errors.firstNameLatin} required={latinFirstRole}>
        <input
          value={f.firstNameLatin}
          dir="ltr"
          placeholder="Ahmed"
          onChange={(e) => set("firstNameLatin", e.target.value)}
          onBlur={() => latinFirst && set("firstNameLatin", latinFirst)}
          className={inputCls(errors.firstNameLatin)}
        />
      </Field>
      <Field label={t("admin.account.f.lastNameLatin")} error={errors.lastNameLatin} required={latinFirstRole}>
        <input
          value={f.lastNameLatin}
          dir="ltr"
          placeholder="BEN ALI"
          onChange={(e) => set("lastNameLatin", e.target.value)}
          onBlur={() => latinLast && set("lastNameLatin", latinLast)}
          className={inputCls(errors.lastNameLatin)}
        />
      </Field>
    </Group>
  );
  const arabicGroup = (
    <Group icon={Languages} title={t("admin.account.group.arabic")}>
      <Field label={t("admin.account.f.firstName")} error={errors.firstName} required={!latinFirstRole}>
        <input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls(errors.firstName)} data-testid="acc-firstName" />
      </Field>
      <Field label={t("admin.account.f.lastName")} error={errors.lastName} required={!latinFirstRole}>
        <input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls(errors.lastName)} />
      </Field>
    </Group>
  );

  return (
    <div className="space-y-5">
      {/* names, both scripts, and how they will read */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {latinFirstRole ? latinGroup : arabicGroup}
        {latinFirstRole ? arabicGroup : latinGroup}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-gold/40 bg-gold/5 px-5 py-4">
        <span className="text-[11.5px] font-semibold text-gold">{t("admin.account.preview")}</span>
        <span className="font-serif text-[17px] font-bold text-forest">{[f.firstName.trim(), f.lastName.trim()].filter(Boolean).join(" ") || "—"}</span>
        <span className="h-5 w-px bg-forest/15" />
        <span dir="ltr" className="font-serif text-[16px] font-semibold tracking-wide text-forest/80">
          {[latinFirst, latinLast].filter(Boolean).join(" ") || "—"}
        </span>
      </div>

      <Group icon={Fingerprint} title={t("admin.account.group.identity")}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {canUsername && (
            <Field label={t("admin.account.f.username")} error={errors.username} hint={t("admin.account.usernameHint")}>
              <div className="relative">
                <AtSign size={16} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-gold" />
                <input value={f.username} dir="ltr" onChange={(e) => set("username", e.target.value)} className={`${inputCls(errors.username)} ps-11`} placeholder="admin" />
              </div>
            </Field>
          )}
          <div className={canUsername ? undefined : "md:col-span-2"}>
            <Field label={t("admin.account.f.phone")} error={errors.phone}>
              <div className="relative">
                <Phone size={16} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-gold" />
                <input value={f.phone} dir="ltr" inputMode="tel" onChange={(e) => set("phone", e.target.value)} className={`${inputCls(errors.phone)} ps-11`} placeholder="+213 5xx xx xx xx" data-testid="acc-phone" />
              </div>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={t("admin.account.f.gender")} hint={t("admin.account.genderHint")} group>
              <GenderSelect value={f.gender} onChange={(v) => set("gender", v)} />
            </Field>
          </div>
        </div>
      </Group>

      {/* A professor's own address — signing in stays by the university one; links and alerts go here once confirmed. */}
      {a.professor && a.can.email && (
        <Group icon={Mail} title={t("admin.account.group.personalEmail")} hint={t("admin.account.personalEmailHint")}>
          <EmailRow a={a} />
        </Group>
      )}

      {a.professor && (
        <>
          <RecordGroup a={a} />
          <ManagedNote a={a} />
        </>
      )}

      <SaveBar
        changes={changes}
        invalid={Object.keys(errors).length > 0}
        busy={update.isPending}
        onReset={() => setF(initial)}
        onSave={() => update.mutate(patch)}
      />
    </div>
  );
}

/* ── personal, for those who only read it ─────────────────── */

const gradeText = (g: unknown) => (Array.isArray(g) ? g.filter(Boolean).join("، ") : typeof g === "string" ? g : "");

/** The hero's side card for a professor or a student: who they are on file. */
function IdentityCard({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const s = a.student;
  const p = a.professor;
  const rows: { label: string; value: string; ltr?: boolean }[] = s
    ? [
        { label: t("admin.account.f.registrationNumber"), value: s.registrationNumber, ltr: true },
        { label: t("admin.account.f.academicYear"), value: s.academicYear?.title ?? "—", ltr: true },
      ]
    : p
      ? [
          { label: t("admin.account.f.employeeNumber"), value: p.employeeNumber, ltr: true },
          { label: t("admin.account.f.rank"), value: gradeText(p.grade) || "—" },
        ]
      : [];
  return (
    <div className="flex min-w-60 flex-col justify-center divide-y divide-white/10 rounded-3xl border border-white/10 bg-cream/5 px-5 py-3 backdrop-blur-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-5 py-2.5">
          <span className="text-[12px] text-cream/70">{r.label}</span>
          <b dir={r.ltr ? "ltr" : undefined} className="font-serif text-[16px] text-cream tabular-nums">
            {r.value}
          </b>
        </div>
      ))}
    </div>
  );
}

type RecordRow = { icon: LucideIcon; label: string; value: ReactNode; ltr?: boolean };

/** A professor's position or a student's studies, as the administration keeps them. */
function RecordGroup({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const s = a.student;
  const p = a.professor;
  const spec = s?.specialization;
  const rows: RecordRow[] = s
    ? [
        { icon: IdCard, label: t("admin.account.f.registrationNumber"), value: s.registrationNumber, ltr: true },
        { icon: GraduationCap, label: t("admin.account.f.specialization"), value: spec ? `${spec.name} · ${t(`admin.proj.level.${spec.level}`)}` : "—" },
        { icon: Building2, label: t("admin.account.f.filiere"), value: spec?.filiere?.name ?? "—" },
        { icon: Building2, label: t("admin.account.f.department"), value: spec?.filiere?.department?.name ?? "—" },
        { icon: Building2, label: t("admin.account.f.faculty"), value: spec?.filiere?.department?.faculty?.name ?? "—" },
        {
          icon: CalendarRange,
          label: t("admin.account.f.academicYear"),
          value: s.academicYear ? (
            <span className="inline-flex items-center gap-1.5" dir="ltr">
              {s.academicYear.title}
              {s.academicYear.isActive && <span className="rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-gold">{t("admin.yearArchive.current")}</span>}
            </span>
          ) : (
            "—"
          ),
        },
      ]
    : p
      ? [
          { icon: IdCard, label: t("admin.account.f.employeeNumber"), value: p.employeeNumber, ltr: true },
          { icon: Mail, label: t("admin.account.f.universityEmail"), value: p.universityEmail, ltr: true },
          { icon: Award, label: t("admin.account.f.rank"), value: gradeText(p.grade) || "—" },
          { icon: Building2, label: t("admin.account.f.department"), value: p.department?.name ?? "—" },
          { icon: Building2, label: t("admin.account.f.faculty"), value: p.department?.faculty?.name ?? "—" },
        ]
      : [];
  if (!rows.length) return null;
  return (
    <Group icon={s ? GraduationCap : Building2} title={t(s ? "admin.account.group.study" : "admin.account.group.work")}>
      <div className={p ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "space-y-3"}>
        {rows.map((r) => (
          <ReadRow key={r.label} icon={r.icon} label={r.label} value={r.value} ltr={r.ltr} />
        ))}
      </div>
    </Group>
  );
}

/** What the administration keeps, and the way to ask it for a correction. */
function ManagedNote({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const { lang } = useParams();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/6 px-4 py-3.5">
      <Lock size={16} className="shrink-0 text-sky-600 dark:text-sky-300" />
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-forest">{t(`admin.account.managed_${a.role}`)}</p>
      <Link
        to={`/${lang}/${a.role}/messages`}
        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-cream-card px-3.5 py-2 text-[12.5px] font-semibold text-sky-700 transition hover:bg-sky-500/10 dark:text-sky-300"
      >
        <MessageSquare size={14} />
        {t("admin.account.contactAdmin")}
      </Link>
    </div>
  );
}

/**
 * A student's own record. The administration keeps nearly all of it — a
 * registration number, a specialization, the Latin name are its to change —
 * so it reads here, with the way to ask for a correction. Two things are the
 * student's own (the user's decision, 2026-11-18): the first and last name in
 * Arabic — corrected, or filled in when left empty — and the email.
 */
function ProfileWing({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const student = a.role === "student";
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Group icon={Languages} title={t("admin.account.group.name")}>
          <div className="space-y-3">
            {student && a.can.edit.includes("firstName") ? (
              <StudentNameRow a={a} />
            ) : (
              <ReadRow icon={UserRound} label={t("admin.account.f.fullName")} value={[a.firstName, a.lastName].filter(Boolean).join(" ") || "—"} />
            )}
            <ReadRow icon={Globe} label={t("admin.account.f.latinName")} value={[a.firstNameLatin, a.lastNameLatin].filter(Boolean).join(" ") || "—"} ltr />
            {student && a.can.email ? (
              <EmailRow a={a} />
            ) : (
              a.email && <ReadRow icon={Mail} label={t("admin.account.f.email")} value={a.email} ltr />
            )}
          </div>
          <Field label={t("admin.account.f.gender")} hint={a.gender ? undefined : t("admin.account.genderUnset")} group>
            <GenderSelect value={a.gender} onChange={() => undefined} readOnly />
          </Field>
        </Group>
        <RecordGroup a={a} />
      </div>
      <ManagedNote a={a} />
    </div>
  );
}

/** A name in Arabic letters, as the server takes it: letters, a space, a hyphen, an apostrophe — two at least. */
const ARABIC_NAME = /^[\u0620-\u0652\u0670-\u06D3\s'-]+$/;
const ARABIC_LETTER = /[\u0620-\u064A\u0671-\u06D3]/;
const squashed = (s: string) => s.trim().replace(/\s+/g, " ");

/** A row the student may change: what it holds, and the pencil — or, empty, the way to fill it in. */
function EditableRow({
  icon: Icon,
  label,
  value,
  empty,
  action,
  onEdit,
  ltr,
  badge,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  empty: boolean;
  action: string;
  onEdit: () => void;
  ltr?: boolean;
  /** Beside the label: the email's state, say. */
  badge?: ReactNode;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
        empty ? "border-dashed border-gold/45 bg-gold/[0.05]" : "border-forest/8 bg-cream-card/60"
      }`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[11px] text-clay">
          {label}
          {badge}
        </p>
        <p dir={ltr && !empty ? "ltr" : undefined} className={`truncate text-[14px] font-semibold ${empty ? "text-clay" : "text-forest"} ${ltr && !empty ? "text-start" : ""}`}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        data-testid={`${testId}-edit`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] font-bold text-forest transition hover:border-gold/70 hover:bg-gold/20"
      >
        {empty ? <Plus size={14} className="text-gold" /> : <Pencil size={13} className="text-gold" />}
        {action}
      </button>
    </div>
  );
}

/**
 * The frame of a form opened in place of its row: a gold tile and a title,
 * what it is for, the fields — and, under a hairline, the way out and the way
 * on. The name and the email open in it alike.
 */
function InPlaceForm({
  icon: Icon,
  title,
  subtitle,
  onCancel,
  footer,
  testId,
  onSubmit,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onCancel: () => void;
  footer: ReactNode;
  testId: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <form
      noValidate
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="animate-scale-in relative overflow-hidden rounded-3xl border border-gold/30 bg-cream-card shadow-[0_22px_48px_-28px_rgba(26,49,45,0.7)]"
    >
      {/* a glow of gold in the corner, and a hairline across the top */}
      <div aria-hidden className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full bg-gold/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-gold/70 to-transparent" />

      <header className="relative flex items-start gap-3.5 px-5 pt-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold to-gold-soft text-[#1a312d] shadow-[0_10px_24px_-10px_rgba(193,150,90,0.9)]">
          <Icon size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[17px] leading-tight font-bold text-forest">{title}</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-clay">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("admin.cancel")}
          title={t("admin.cancel")}
          className="grid size-8 shrink-0 place-items-center rounded-xl text-clay transition hover:bg-forest/6 hover:text-forest"
        >
          <X size={16} />
        </button>
      </header>

      <div className="relative space-y-4 px-5 pt-5 pb-5">{children}</div>

      <footer className="relative flex flex-wrap items-center justify-between gap-3 border-t border-forest/8 bg-cream-2/40 px-5 py-3.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-[12.5px] font-semibold text-clay transition hover:bg-forest/5 hover:text-forest"
        >
          {t("admin.cancel")}
        </button>
        {footer}
      </footer>
    </form>
  );
}

/** The first and last name in Arabic: corrected — or filled in, when the administration left them empty. */
function StudentNameRow({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const update = useUpdateMyAccount();
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(a.firstName ?? "");
  const [last, setLast] = useState(a.lastName ?? "");
  const full = [a.firstName, a.lastName].filter(Boolean).join(" ");

  const check = (s: string) => {
    const v = squashed(s);
    if (!v) return t("admin.account.err.required");
    return v.length >= 2 && ARABIC_NAME.test(v) && ARABIC_LETTER.test(v) ? undefined : t("account.student.err.arabic");
  };
  const errFirst = check(first);
  const errLast = check(last);
  const patch: MyAccountPatch = {};
  if (squashed(first) !== (a.firstName ?? "")) patch.firstName = squashed(first);
  if (squashed(last) !== (a.lastName ?? "")) patch.lastName = squashed(last);
  const changes = Object.keys(patch).length;
  // What it will read as, live — the way it prints.
  const preview = [squashed(first), squashed(last)].filter(Boolean).join(" ");

  const cancel = () => {
    setEditing(false);
    setFirst(a.firstName ?? "");
    setLast(a.lastName ?? "");
  };

  if (!editing)
    return (
      <EditableRow
        icon={UserRound}
        label={t("admin.account.f.fullName")}
        value={full || t("account.student.nameEmpty")}
        empty={!full}
        action={full ? t("account.student.edit") : t("account.student.addName")}
        onEdit={() => setEditing(true)}
        testId="student-name"
      />
    );
  return (
    <InPlaceForm
      icon={UserRound}
      title={t("account.student.nameTitle")}
      subtitle={t("account.student.nameHint")}
      onCancel={cancel}
      testId="student-name-form"
      onSubmit={() => {
        if (!errFirst && !errLast && changes) update.mutate(patch);
      }}
      footer={
        <PrimaryBtn type="submit" disabled={!!errFirst || !!errLast || !changes} busy={update.isPending} icon={Check} testId="student-name-save">
          {t("account.student.save")}
        </PrimaryBtn>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("admin.account.f.firstName")} error={first ? errFirst : undefined} required>
          <input
            dir="rtl"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            aria-label={t("admin.account.f.firstName")}
            placeholder={t("account.student.firstNamePlaceholder")}
            autoFocus
            className={`${inputCls(first ? errFirst : undefined)} h-12 text-[15px]`}
          />
        </Field>
        <Field label={t("admin.account.f.lastName")} error={last ? errLast : undefined} required>
          <input
            dir="rtl"
            value={last}
            onChange={(e) => setLast(e.target.value)}
            aria-label={t("admin.account.f.lastName")}
            placeholder={t("account.student.lastNamePlaceholder")}
            className={`${inputCls(last ? errLast : undefined)} h-12 text-[15px]`}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-forest/8 bg-cream-2/50 px-4 py-3" data-testid="student-name-preview">
        <span className="text-[11px] font-semibold text-clay">{t("account.student.namePreview")}</span>
        <span className={`min-w-0 flex-1 truncate font-serif text-[16px] font-bold ${preview ? "text-forest" : "text-clay/50"}`}>{preview || "—"}</span>
      </div>
    </InPlaceForm>
  );
}

/**
 * The account's own email — a student's, or a professor's beside the university
 * address: given — or changed — with the current password; the link that
 * proves it leaves on saving.
 */
function EmailRow({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const change = useChangeMyEmail();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const same = email.trim().toLowerCase() === (a.email ?? "").toLowerCase();
  const ready = valid && !same && !!pw;
  // Where the student is: the address, the password, then the link.
  const step = !valid || same ? 1 : !pw ? 2 : 3;

  const cancel = () => {
    setEditing(false);
    setEmail("");
    setPw("");
  };

  const state = a.email ? (
    <span
      data-testid="student-email-state"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        a.emailVerified ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
      }`}
    >
      {a.emailVerified ? <MailCheck size={11} /> : <TriangleAlert size={11} />}
      {t(a.emailVerified ? "account.student.emailVerified" : "account.student.emailUnverified")}
    </span>
  ) : null;

  if (!editing)
    return (
      <EditableRow
        icon={Mail}
        label={t("admin.account.f.email")}
        value={a.email || t("account.student.emailEmpty")}
        empty={!a.email}
        action={a.email ? t("account.student.edit") : t("account.student.addEmail")}
        onEdit={() => setEditing(true)}
        ltr
        badge={state}
        testId="student-email"
      />
    );
  return (
    <InPlaceForm
      icon={Mail}
      title={t(a.email ? "account.student.emailTitleChange" : "account.student.emailTitleAdd")}
      subtitle={t("account.student.emailSubtitle")}
      onCancel={cancel}
      testId="student-email-form"
      onSubmit={() => {
        if (ready) change.mutate({ email: email.trim(), currentPassword: pw });
      }}
      footer={
        <PrimaryBtn type="submit" disabled={!ready} busy={change.isPending} icon={Send} testId="student-email-save">
          {t(change.isPending ? "account.student.savingEmail" : "account.student.saveEmail")}
        </PrimaryBtn>
      }
    >
      {a.email && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-forest/8 bg-cream-2/50 px-4 py-3">
          <span className="text-[11px] font-semibold text-clay">{t("admin.account.email.current")}</span>
          <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-[13.5px] font-bold text-forest">
            {a.email}
          </span>
          {state}
        </div>
      )}

      {/* the three steps, the one reached in gold */}
      <ol className="grid grid-cols-3 gap-2" data-testid="student-email-steps">
        {[1, 2, 3].map((n) => {
          const done = n < step;
          const on = n === step;
          return (
            <li
              key={n}
              data-state={done ? "done" : on ? "current" : "todo"}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-[11.5px] font-semibold transition ${
                on ? "border-gold/50 bg-gold/10 text-forest" : done ? "border-emerald-500/25 bg-emerald-500/[0.06] text-forest/80" : "border-forest/8 text-clay"
              }`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  done ? "bg-emerald-500 text-white" : on ? "bg-linear-to-br from-gold to-gold-soft text-[#1a312d]" : "bg-forest/8 text-clay"
                }`}
              >
                {done ? <Check size={12} strokeWidth={3} /> : n}
              </span>
              <span className="min-w-0 truncate">{t(`account.student.emailStep${n}`)}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("admin.account.email.new")} error={email && !valid ? t("admin.account.err.email") : email && same ? t("admin.account.err.sameEmail") : undefined}>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-gold" />
            <input
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-label={t("admin.account.email.new")}
              autoFocus
              placeholder="name@example.com"
              className={`${inputCls(email && (!valid || same) ? "x" : undefined)} h-12 ps-11 pe-10`}
            />
            {valid && !same && <CheckCircle2 size={17} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-emerald-500" />}
          </div>
        </Field>
        <Field label={t("admin.account.currentPassword")}>
          <Secret value={pw} onChange={setPw} autoComplete="current-password" testId="student-email-password" />
        </Field>
      </div>

      <p className="flex items-start gap-2.5 rounded-2xl bg-sky-500/[0.07] px-4 py-3 text-[12px] leading-relaxed text-forest/85 ring-1 ring-sky-400/25">
        <Send size={15} className="mt-0.5 shrink-0 text-sky-600 rtl:-scale-x-100 dark:text-sky-300" />
        {t(a.role === "professor" ? "account.student.emailHintProfessor" : "account.student.emailHint")}
      </p>
    </InPlaceForm>
  );
}

function ReadRow({ icon: Icon, label, value, ltr }: { icon: LucideIcon; label: string; value: ReactNode; ltr?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-forest/8 bg-cream-card/60 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-clay">{label}</p>
        <p dir={ltr ? "ltr" : undefined} className={`truncate text-[14px] font-semibold text-forest ${ltr ? "text-start" : ""}`}>
          {value}
        </p>
      </div>
      <Lock size={13} className="shrink-0 text-clay/40" />
    </div>
  );
}

/* ── photo ────────────────────────────────────────────────── */

function PhotoWing({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const update = useUpdateMyAccount();
  const setAvatar = useSetMyAvatar();
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [removing, setRemoving] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = setAvatar.isPending || update.isPending;

  function take(file?: File | null) {
    if (file && /^image\/(png|jpeg|webp)$/.test(file.type)) setCropFile(file);
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
          over ? "border-gold bg-gold/10" : "border-forest/15 bg-cream-2/40"
        }`}
      >
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative">
          <span className="absolute -inset-3 rounded-full bg-linear-to-br from-gold/40 to-transparent blur-md" />
          <UserAvatar user={a} size={150} className="relative ring-4 ring-cream-card" />
          {busy && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-forest-deep/55">
              <Loader2 size={30} className="animate-spin text-cream" />
            </span>
          )}
        </div>
        <div className="relative">
          <p className="text-[14px] font-semibold text-forest">{over ? t("admin.account.photo.dropNow") : t("admin.account.photo.drop")}</p>
          <p className="mt-1 text-[12px] text-clay">{t("admin.account.photo.rules")}</p>
        </div>
        <div className="relative flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            data-testid="acc-photo-upload"
            className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-l from-gold to-gold-soft px-5 py-3 text-sm font-bold text-forest-deep shadow-[0_10px_24px_-12px_rgba(193,150,90,0.9)] transition hover:brightness-105 disabled:opacity-60"
          >
            {a.avatarUrl ? <ImagePlus size={16} /> : <Upload size={16} />}
            {a.avatarUrl ? t("admin.account.photo.change") : t("admin.account.photo.upload")}
          </button>
          {a.avatarUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setRemoving(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-300/50 bg-cream-card px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300"
            >
              <Trash2 size={15} />
              {t("admin.account.photo.remove")}
            </button>
          )}
        </div>
      </div>

      {/* where the photo shows up */}
      <div className="space-y-3">
        <p className="text-[11.5px] font-bold tracking-wide text-gold">{t("admin.account.photo.where")}</p>
        {(
          [
            [72, "admin.account.photo.inProfile"],
            [40, "admin.account.photo.inMessages"],
            [30, "admin.account.photo.inMenu"],
          ] as const
        ).map(([size, label]) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-forest/10 bg-cream-2/40 p-3">
            <UserAvatar user={a} size={size} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-forest">{personName(a)}</p>
              <p className="text-[11px] text-clay">{t(label)}</p>
            </div>
          </div>
        ))}
        {!a.avatarUrl && <p className="rounded-2xl bg-amber-500/8 px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-200">{t("admin.account.photo.defaultNote")}</p>}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <ImageCropperDialog
        open={!!cropFile}
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onDone={(cropped) => {
          setCropFile(null);
          setAvatar.mutate(cropped);
        }}
      />
      <ConfirmDialog
        icon={ImageMinus}
        open={removing}
        tone="danger"
        title={t("admin.account.photo.remove")}
        message={t("admin.account.photo.removeConfirm")}
        confirmLabel={t("admin.account.photo.remove")}
        loading={update.isPending}
        onConfirm={() => update.mutate({ avatarUrl: null }, { onSuccess: () => setRemoving(false) })}
        onClose={() => setRemoving(false)}
      />
    </div>
  );
}

/* ── email ────────────────────────────────────────────────── */

function EmailWing({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const change = useChangeMyEmail();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const same = email.trim().toLowerCase() === (a.email ?? "").toLowerCase();
  const ready = valid && !same && !!pw;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-forest/10 bg-linear-to-l from-cream-2/80 to-cream-card p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
            <MailCheck size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-[11.5px] text-clay">{t("admin.account.email.current")}</p>
            <p dir="ltr" className="truncate text-start font-serif text-[19px] font-bold text-forest">
              {a.email ?? "—"}
            </p>
            <p className="mt-0.5 text-[11.5px] text-clay">{t("admin.account.email.usedFor")}</p>
          </div>
        </div>
      </div>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex items-center gap-2.5 rounded-2xl border border-forest/8 bg-cream-2/40 px-3 py-2.5 text-[12px] text-forest">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold/15 text-[11px] font-bold text-gold">{n}</span>
            {t(`admin.account.email.step${n}`)}
          </li>
        ))}
      </ol>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) change.mutate({ email: email.trim(), currentPassword: pw });
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t("admin.account.email.new")} error={email && !valid ? t("admin.account.err.email") : email && same ? t("admin.account.err.sameEmail") : undefined}>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-gold" />
              <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={`${inputCls(email && (!valid || same) ? "x" : undefined)} ps-11`} placeholder="name@univ-eloued.dz" />
            </div>
          </Field>
          <Field label={t("admin.account.currentPassword")}>
            <Secret value={pw} onChange={setPw} autoComplete="current-password" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/8 px-4 py-3">
          <TriangleAlert size={16} className="shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="flex-1 text-[12px] leading-relaxed text-amber-800 dark:text-amber-200">{t("admin.account.email.warning")}</p>
          <PrimaryBtn type="submit" disabled={!ready} busy={change.isPending} icon={Check}>
            {t("admin.account.email.submit")}
          </PrimaryBtn>
        </div>
      </form>
    </div>
  );
}

/* ── security ─────────────────────────────────────────────── */

function SecurityWing({ a }: { a: MyAccount }) {
  const { t } = useTranslation();
  const { logoutEverywhere } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const facts: { icon: LucideIcon; label: string; value: string; tone?: string }[] = [
    { icon: Clock, label: t("admin.account.lastLogin"), value: a.lastLoginAt ? relative(a.lastLoginAt) : "—" },
    {
      icon: ShieldCheck,
      label: t("admin.account.security.status"),
      value: t(`admin.struct.spec.status.${a.status === "suspended" ? "suspended" : "active"}`),
      tone: a.status === "suspended" ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300",
    },
    { icon: BadgeCheck, label: t("admin.account.security.verification"), value: a.isVerified ? t("admin.struct.spec.verified") : t("admin.account.security.notVerified") },
    { icon: RotateCcw, label: t("admin.account.security.updated"), value: relative(a.updatedAt) },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="rounded-2xl border border-forest/10 bg-cream-2/40 p-4">
            <span className="mb-2 flex items-center gap-1.5 text-[11.5px] text-clay">
              <f.icon size={14} className="text-gold" />
              {f.label}
            </span>
            <b className={`block font-serif text-[17px] ${f.tone ?? "text-forest"}`}>{f.value}</b>
          </div>
        ))}
      </div>

      <RecoveryEmailCard a={a} />

      {a.twoFactor.available && <TwoFactorCard a={a} />}

      <DevicesCard />

      <div className="flex items-start gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/6 p-4">
        <Laptop size={18} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-300" />
        <p className="text-[12.5px] leading-relaxed text-forest">{t("admin.account.security.thisDevice")}</p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-red-300/45 bg-red-500/5 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-500/12 text-red-600 dark:text-red-300">
            <ShieldAlert size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-forest">{t("admin.account.security.everywhere")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-clay">{t("admin.account.security.everywhereHint")}</p>
          </div>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-300/60 bg-cream-card px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
          >
            <LogOut size={15} className="rtl:rotate-180" />
            {t("admin.account.security.everywhereAction")}
          </button>
        </div>
      </div>
      <ConfirmDialog
        icon={LogOut}
        open={confirm}
        tone="danger"
        title={t("admin.account.security.everywhere")}
        message={t("admin.account.security.everywhereConfirm")}
        confirmLabel={t("admin.account.security.everywhereAction")}
        onConfirm={() => logoutEverywhere()}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

const DEVICE_ICON: Record<AccountSession["device"]["type"], LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  unknown: MonitorSmartphone,
};

/** "Chrome on Windows", or whatever part of it is known. */
function deviceName(t: (k: string, o?: Record<string, string>) => string, d: AccountSession["device"]) {
  if (d.browser && d.os) return t("admin.account.security.deviceOn", { browser: d.browser, os: d.os });
  return d.browser ?? d.os ?? t("admin.account.security.unknownDevice");
}

/** Minutes matter here — "this hour" says little about a device. */
function ago(iso: string) {
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(mins) < 1) return rtf.format(0, "second");
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

/**
 * Every device signed in to the account. Signing one out takes effect at once:
 * its requests are refused, and its open page is told over the socket.
 */
function DevicesCard() {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  const { data, isLoading, isError, refetch } = useMySessions();
  const end = useEndMySession();
  const [target, setTarget] = useState<AccountSession | null>(null);

  return (
    <div className="rounded-3xl border border-forest/10 bg-cream-2/40 p-5" data-testid="account-devices">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
          <MonitorSmartphone size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] font-bold text-forest">
            {t("admin.account.security.devices")}
            {data && <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[11px] font-bold text-clay">{data.length}</span>}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-clay">{t("admin.account.security.devicesHint")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-8 text-clay">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : isError ? (
        <ErrorRetry compact title={t("admin.account.security.devicesError")} onRetry={refetch} />
      ) : !data?.length ? (
        <p className="py-4 text-center text-[12.5px] text-clay">{t("admin.account.security.noDevices")}</p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((s) => {
            const Icon = DEVICE_ICON[s.device.type];
            const busy = end.isPending && end.variables === s.id;
            return (
              <li
                key={s.id}
                data-testid="account-device"
                className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3.5 sm:flex-nowrap ${
                  s.current ? "border-gold/45 bg-gold/6" : "border-forest/10 bg-cream-card"
                }`}
              >
                <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-forest/6 text-forest">
                  <Icon size={20} />
                  {s.online && <span className="absolute -end-0.5 -top-0.5 size-3 rounded-full border-2 border-cream-card bg-emerald-500" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-bold text-forest">
                    <span dir="auto">{deviceName(t, s.device)}</span>
                    {s.current && (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-bold text-gold">{t("admin.account.security.current")}</span>
                    )}
                    {s.online && !s.current && (
                      <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-300">
                        {t("admin.account.security.online")}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-clay">
                    <span>{t(`admin.account.security.type.${s.device.type}`)}</span>
                    {s.ip && (
                      <>
                        <span aria-hidden>·</span>
                        {/* Isolated, or the RTL line reorders it: "::1" reads "1::". */}
                        <bdi dir="ltr" className="font-mono">
                          {s.ip}
                        </bdi>
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <span>
                      {t("admin.account.security.lastActive")}:{" "}
                      {s.current || s.online ? t("admin.account.security.online") : ago(s.lastActiveAt)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>
                      {t("admin.account.security.since")}: {fmtDate(s.createdAt, true)}
                    </span>
                  </p>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    onClick={() => setTarget(s)}
                    disabled={busy}
                    data-testid="account-device-signout"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-300/60 px-3.5 py-2 text-[12.5px] font-bold text-red-600 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} className="rtl:rotate-180" />}
                    {t("admin.account.security.signOut")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        icon={LogOut}
        open={!!target}
        tone="danger"
        title={t("admin.account.security.signOutTitle")}
        message={target ? t("admin.account.security.signOutConfirm", { name: deviceName(t, target.device) }) : ""}
        confirmLabel={t("admin.account.security.signOut")}
        loading={end.isPending}
        onConfirm={() => target && end.mutate(target.id, { onSettled: () => setTarget(null) })}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}

/* ── preferences ──────────────────────────────────────────── */

function PrefsWing() {
  const { t } = useTranslation();
  const { currentLang, languages, switchLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const themes: { key: "light" | "dark" | "system"; icon: LucideIcon; swatch: string }[] = [
    { key: "light", icon: Sun, swatch: "bg-linear-to-br from-[#fbf6ec] to-[#efe4cf]" },
    { key: "dark", icon: Moon, swatch: "bg-linear-to-br from-[#1b2724] to-[#0e1614]" },
    { key: "system", icon: Laptop, swatch: "bg-linear-to-br from-[#fbf6ec] via-[#8a8f84] to-[#0e1614]" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-forest">
          <Globe size={16} className="text-gold" />
          {t("admin.account.prefs.language")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup">
          {languages.map((l) => {
            const on = l.code === currentLang;
            return (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => !on && switchLanguage(l.code)}
                className={`relative flex items-center gap-3 rounded-2xl border p-4 text-start transition ${
                  on ? "border-gold/60 bg-gold/10 shadow-[0_0_0_1px_rgba(193,150,90,0.25)]" : "border-forest/12 hover:border-forest/25 hover:bg-forest/[0.03]"
                }`}
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl font-serif text-[15px] font-bold ${on ? "bg-gold text-forest-deep" : "bg-forest/6 text-forest"}`}>{l.labelShort}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-forest">{l.label}</span>
                  <span className="text-[11px] text-clay">{l.dir === "rtl" ? t("admin.account.prefs.rtl") : t("admin.account.prefs.ltr")}</span>
                </span>
                {on && <Check size={17} className="shrink-0 text-gold" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-forest">
          <Palette size={16} className="text-gold" />
          {t("admin.account.prefs.theme")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup">
          {themes.map((x) => {
            const on = theme === x.key;
            return (
              <button
                key={x.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTheme(x.key, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
                }}
                className={`overflow-hidden rounded-2xl border text-start transition ${
                  on ? "border-gold/60 shadow-[0_0_0_1px_rgba(193,150,90,0.25)]" : "border-forest/12 hover:border-forest/25"
                }`}
              >
                <span className={`relative block h-20 ${x.swatch}`}>
                  <span className="absolute inset-x-4 top-4 h-2 rounded-full bg-white/40" />
                  <span className="absolute inset-x-4 top-8 h-2 w-1/2 rounded-full bg-[#c1965a]/70" />
                  <span className="absolute bottom-3 start-4 h-5 w-14 rounded-md bg-[#c1965a]" />
                </span>
                <span className={`flex items-center gap-2 px-4 py-3 ${on ? "bg-gold/10" : "bg-cream-card"}`}>
                  <x.icon size={15} className={on ? "text-gold" : "text-clay"} />
                  <span className="flex-1 text-[13px] font-semibold text-forest">{t(`admin.account.prefs.theme_${x.key}`)}</span>
                  {on && <Check size={15} className="text-gold" />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-clay">{t("admin.account.prefsHint")}</p>
      </div>
    </div>
  );
}

/* ── small pieces ─────────────────────────────────────────── */

function Group({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-forest/10 bg-cream-2/30 p-5">
      <p className="mb-4 flex items-center gap-2 text-[13px] font-bold text-forest">
        <span className="grid size-8 place-items-center rounded-lg bg-gold/12 text-gold">
          <Icon size={15} />
        </span>
        {title}
      </p>
      <div className="space-y-4">{children}</div>
      {hint && <p className="mt-3 text-[11px] leading-relaxed text-clay">{hint}</p>}
    </div>
  );
}

/** Appears with the first change and stays in reach until it is saved. */
function SaveBar({ changes, invalid, busy, onReset, onSave }: { changes: number; invalid: boolean; busy: boolean; onReset: () => void; onSave: () => void }) {
  const { t } = useTranslation();
  const dirty = changes > 0;
  return (
    <div
      className={`sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md transition duration-300 ${
        dirty ? "border-gold/50 bg-cream-card/95 shadow-[0_18px_40px_-16px_rgba(22,36,31,0.45)]" : "border-forest/8 bg-cream-2/40"
      }`}
    >
      <span className="flex flex-1 items-center gap-2 text-[12.5px] text-clay">
        {dirty ? <span className="size-2 animate-pulse rounded-full bg-gold" /> : <Check size={14} className="text-emerald-600 dark:text-emerald-300" />}
        {dirty ? t("admin.account.unsaved", { count: changes }) : t("admin.account.upToDate")}
      </span>
      <button
        type="button"
        onClick={onReset}
        disabled={!dirty || busy}
        className="inline-flex items-center gap-1.5 rounded-2xl border border-forest/15 px-4 py-2.5 text-sm font-semibold text-forest transition hover:bg-forest/5 disabled:opacity-40"
      >
        <RotateCcw size={14} />
        {t("admin.account.reset")}
      </button>
      <PrimaryBtn onClick={onSave} disabled={!dirty || invalid} busy={busy} icon={Save} testId="acc-save">
        {t("admin.account.save")}
      </PrimaryBtn>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const size = 66;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-cream/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (value / 100) * c}
          className="stroke-gold transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-serif text-[15px] font-bold text-cream tabular-nums">{value}%</span>
    </div>
  );
}
