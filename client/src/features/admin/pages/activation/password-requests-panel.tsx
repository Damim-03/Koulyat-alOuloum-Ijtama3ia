import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownUp,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  IdCard,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ScanLine,
  Search,
  SearchX,
  ShieldAlert,
  ShieldQuestion,
  UserRound,
  XCircle,
} from "lucide-react";
import { useDates } from "../../../../hooks/use-dates";
import { serverMessage } from "../../../../lib/api/error";
import { REASON_MAX } from "../../../../lib/limits";
import { CharCount } from "../../../../components/ui/char-count";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import { PasswordChecklist } from "../../../account/components/password-form";
import { StudentCard } from "../../../../components/ui/student-card";
import { passwordIssue } from "../../../account/lib/password-rules";
import {
  useDecidePasswordRequest,
  usePasswordRequestPhoto,
  usePasswordRequests,
  type PasswordRequestItem,
} from "../../api/password-requests.api";
import { Chip, PrivatePhoto, ProfileDrawer, ToolButton, initials } from "./requests-panel";

/**
 * طلبات كلمة المرور (Backend modules/password-request): طلبةٌ لا بريد مؤكَّداً
 * لحساباتهم نسوا كلمة المرور، فأرسلوا من «نسيت كلمة المرور» صورة بطاقتهم.
 * يتحقّق المسؤول أنّها بطاقة صاحب الحساب، ثمّ يكتب له كلمة مرور — بقواعد
 * الموقع — فتظهر للطالب على الجهاز الذي أرسل منه الطلب وحده، ويستبدلها
 * بكلمته عند أوّل دخول؛ أو يرفض بسببٍ يقرؤه الطالب.
 *
 * كلّ طلبٍ يُطوى كما في طلبات التوثيق: الأوّل مفتوح، وصورة المطويّ لا تُجلب.
 */

const keyOf = (r: PasswordRequestItem) => `${r.id}-${r.sentAt}`;

export function PasswordRequestsPanel() {
  const { t } = useTranslation();
  const q = usePasswordRequests();
  const [search, setSearch] = useState("");
  const [newest, setNewest] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  if (q.isLoading) return <LoadingArea className="py-16" />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => q.refetch()} />;
  if (!q.data.items.length) {
    return (
      <div className="forest-glow relative grid min-h-72 place-items-center overflow-hidden rounded-3xl text-center text-cream" data-testid="password-requests-empty">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-20 start-1/4 size-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative max-w-md px-6">
          <span className="mx-auto mb-3 grid size-16 place-items-center rounded-3xl border border-gold/30 bg-gold/10 text-gold-soft">
            <KeyRound size={28} strokeWidth={1.7} />
          </span>
          <p className="font-serif text-[18px] font-bold">{t("admin.passwordRequests.empty")}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-cream/65">{t("admin.passwordRequests.emptyHint")}</p>
        </div>
      </div>
    );
  }

  const all = q.data.items;
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = all
    .filter((r) => {
      const hay = [r.firstName, r.lastName, r.firstNameLatin, r.lastNameLatin, r.registrationNumber].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => (newest ? b.sentAt.localeCompare(a.sentAt) : a.sentAt.localeCompare(b.sentAt)));
  const isOpen = (r: PasswordRequestItem, i: number) => opened[keyOf(r)] ?? i === 0;

  return (
    <div className="space-y-4">
      <section
        className="relative overflow-hidden rounded-3xl border border-forest/10 bg-cream-card p-4 shadow-[0_10px_40px_-24px_rgba(38,66,61,0.45)] sm:p-5"
        data-testid="password-requests-filter"
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-gold/60 to-transparent" />
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-gold/[0.07] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-forest/85 ring-1 ring-gold/20">
          <ShieldQuestion size={16} className="mt-0.5 shrink-0 text-gold" />
          {t("admin.passwordRequests.intro")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[14rem] flex-1">
            <Search size={17} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gold" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.activation.requests.filter.search")}
              aria-label={t("admin.activation.requests.filter.search")}
              data-testid="password-requests-search"
              className="h-11 w-full rounded-2xl border border-forest/12 bg-cream-2 ps-10 pe-3 text-[13px] text-forest outline-none transition placeholder:text-clay/60 focus:border-gold focus:bg-cream-card focus:ring-4 focus:ring-gold/15"
            />
          </label>
          <ToolButton onClick={() => setNewest((n) => !n)} testId="password-requests-sort" icon={ArrowDownUp}>
            {t(newest ? "admin.activation.requests.filter.newest" : "admin.activation.requests.filter.oldest")}
          </ToolButton>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-3 py-1 text-[12px] font-bold text-forest">
            <span aria-hidden className="size-1.5 rounded-full bg-gold" />
            {t("admin.activation.requests.filter.shown", { shown: shown.length, total: all.length })}
          </span>
        </div>
      </section>

      {shown.length ? (
        shown.map((r, i) => (
          <PasswordRequestCard
            key={keyOf(r)}
            r={r}
            open={isOpen(r, i)}
            onToggle={() => setOpened((o) => ({ ...o, [keyOf(r)]: !isOpen(r, i) }))}
            onProfile={() => setProfile(r.id)}
          />
        ))
      ) : (
        <div className="grid min-h-40 place-items-center rounded-3xl border border-dashed border-forest/15 text-center text-clay" data-testid="password-requests-no-match">
          <div>
            <SearchX size={28} className="mx-auto mb-1.5 text-forest/25" />
            <p className="text-[13px] font-semibold text-forest/80">{t("admin.activation.requests.filter.noMatch")}</p>
          </div>
        </div>
      )}

      {profile && <ProfileDrawer id={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}

/** What the card's code said, as a chip. */
function qrChip(r: PasswordRequestItem, t: ReturnType<typeof useTranslation>["t"]) {
  if (r.qrMatches === true) return <Chip tone="green" icon={CheckCircle2}>{t("admin.activation.requests.qrMatch")}</Chip>;
  if (r.qrMatches === false) return <Chip tone="red" icon={AlertTriangle}>{t("admin.activation.requests.qrOther", { number: r.qrNumber })}</Chip>;
  return <Chip tone="amber" icon={ScanLine}>{t("admin.activation.requests.qrUnread")}</Chip>;
}

const fieldCls =
  "h-11 w-full rounded-xl border border-forest/15 bg-cream-card px-3.5 text-[14px] text-forest outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15";

function PasswordRequestCard({
  r,
  open,
  onToggle,
  onProfile,
}: {
  r: PasswordRequestItem;
  open: boolean;
  onToggle: () => void;
  onProfile: () => void;
}) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  const decide = useDecidePasswordRequest();
  // Kept here, not in the folding part: folded and opened again, nothing ticked or typed is lost.
  const [matched, setMatched] = useState(false);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
  const latin = [r.firstNameLatin, r.lastNameLatin].filter(Boolean).join(" ");
  const who = name || latin || r.registrationNumber;
  const body = `password-request-body-${r.id}`;
  const owner = { registrationNumber: r.registrationNumber };
  const issue = password ? passwordIssue(password, owner) : null;
  const mismatch = !!again && again !== password;
  const ready = matched && !!password && !issue && password === again;

  const approve = () =>
    decide.mutate(
      { id: r.id, sentAt: r.sentAt, decision: "approve", password },
      { onSuccess: () => toast.success(t("admin.passwordRequests.done", { name: who })) },
    );
  const refuse = () =>
    decide.mutate(
      { id: r.id, sentAt: r.sentAt, decision: "reject", reason: reason.trim() },
      { onSuccess: () => toast.success(t("admin.activation.requests.refused", { name: who })) },
    );

  return (
    <article
      className={`group/request relative overflow-hidden rounded-3xl border bg-cream-card transition duration-300 ${
        open
          ? "border-gold/30 shadow-[0_24px_60px_-28px_rgba(38,66,61,0.55)]"
          : "border-forest/10 shadow-[0_8px_30px_-20px_rgba(38,66,61,0.35)] hover:-translate-y-px hover:border-gold/25"
      }`}
      data-testid="password-request"
      data-open={open}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 start-0 w-1 bg-linear-to-b ${
          r.qrMatches === true ? "from-emerald-400 to-emerald-600" : r.qrMatches === false ? "from-red-400 to-red-600" : "from-amber-300 to-amber-500"
        }`}
      />
      <span aria-hidden className="pointer-events-none absolute inset-x-16 top-0 h-px bg-linear-to-r from-transparent via-gold/55 to-transparent" />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={body}
        data-testid="password-request-toggle"
        className="flex w-full flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4 text-start transition hover:bg-gold/[0.035] sm:items-center sm:px-6"
      >
        <span className="relative order-1 grid size-12 shrink-0 place-items-center rounded-2xl bg-forest font-serif text-[21px] font-bold text-gold-soft shadow-[0_10px_24px_-12px_rgba(22,36,31,0.9)] ring-1 ring-gold/30">
          {initials(r) || <UserRound size={20} />}
          <span className="absolute -end-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-gold text-forest-deep ring-2 ring-cream-card">
            <KeyRound size={12} />
          </span>
        </span>

        <span className="order-2 min-w-0 flex-1 sm:basis-56">
          <span className="block truncate font-serif text-[18.5px] leading-tight font-bold text-forest" dir="auto">
            {name || latin}
          </span>
          {name && latin && (
            <span className="mt-0.5 block truncate text-[11.5px] font-semibold tracking-[0.14em] text-clay uppercase">
              <bdi dir="ltr">{latin}</bdi>
            </span>
          )}
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-forest/75">
            <bdi dir="ltr" className="rounded-md border border-forest/10 bg-forest/[0.05] px-1.5 py-0.5 font-mono text-[11.5px] font-bold text-forest">
              {r.registrationNumber}
            </bdi>
            <span>
              {r.specialization.name} · {t(`admin.proj.level.${r.specialization.level}`)} · {r.academicYear}
            </span>
          </span>
        </span>

        <span className="order-4 flex basis-full flex-wrap items-center gap-2 ps-16 sm:basis-auto sm:ps-0">
          {qrChip(r, t)}
          {r.verified ? (
            <Chip tone="green" icon={BadgeCheck}>{t("admin.passwordRequests.verified")}</Chip>
          ) : (
            <Chip tone="amber" icon={ShieldQuestion}>{t("admin.passwordRequests.unverified")}</Chip>
          )}
          {r.status !== "active" && (
            <Chip tone="red" icon={ShieldAlert}>
              {t("admin.activation.student.suspended")}
            </Chip>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-forest/10 bg-forest/[0.04] px-2.5 py-1 text-[11.5px] font-semibold text-forest/75">
            <Clock size={13} />
            {fmtDate(r.sentAt, true)}
          </span>
        </span>

        <span
          aria-hidden
          className={`order-3 grid size-9 shrink-0 place-items-center rounded-full border transition duration-300 sm:order-5 ${
            open ? "rotate-180 border-gold/40 bg-gold/12 text-gold" : "border-forest/12 text-forest/60 group-hover/request:border-gold/35 group-hover/request:text-gold"
          }`}
        >
          <ChevronDown size={17} />
        </span>
      </button>

      {open && (
        <div id={body} className="animate-[fadeUp_0.3s_both] px-5 pb-5 sm:px-6 sm:pb-6" data-testid="password-request-body">
          <div aria-hidden className="mb-4 h-px bg-linear-to-r from-transparent via-forest/12 to-transparent" />

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-[12.5px] font-bold text-forest/80">
              <ScanLine size={15} className="text-gold" />
              {t("admin.activation.requests.checkCard")}
            </p>
            <button
              type="button"
              onClick={onProfile}
              data-testid="password-request-profile"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gold/35 bg-gold/[0.08] px-3 py-1.5 text-[12px] font-bold text-forest transition hover:border-gold/60 hover:bg-gold/15"
            >
              <UserRound size={14} className="text-gold" />
              {t("admin.activation.requests.profile")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
            {/* What was sent, and — on the university's card — what it should say. */}
            <div className="space-y-3">
              {r.photo && <CardPhoto id={r.id} sentAt={r.sentAt} />}
              <div className="rounded-2xl border border-forest/10 bg-cream-2/50 p-3">
                <p className="mb-2.5 flex items-center justify-between gap-2 text-[12.5px] font-bold text-forest/80">
                  <span className="inline-flex items-center gap-2">
                    <IdCard size={15} className="text-gold" />
                    {t("admin.passwordRequests.expected")}
                  </span>
                  <span className="text-[11px] font-medium text-clay">{t("admin.passwordRequests.expectedFrom")}</span>
                </p>
                <StudentCard s={r} label={t("admin.passwordRequests.expected")} className="mx-auto max-w-[34rem]" />
                <p className="mt-2 text-[11.5px] leading-relaxed text-clay">{t("admin.passwordRequests.expectedHint")}</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* 1 — the card is this student's */}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                  matched ? "border-emerald-500/40 bg-emerald-500/[0.08]" : "border-gold/35 bg-gold/[0.06] hover:bg-gold/10"
                }`}
              >
                <input
                  type="checkbox"
                  checked={matched}
                  onChange={(e) => setMatched(e.target.checked)}
                  data-testid="password-request-matched"
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-gold/25 ${
                    matched ? "border-emerald-500 bg-emerald-500 text-white" : "border-gold/60 bg-cream-card text-transparent"
                  }`}
                >
                  <Check size={15} strokeWidth={3} />
                </span>
                <span>
                  <span className="block text-[13px] font-bold text-forest">{t("admin.activation.requests.cardLabel")}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-clay">{t("admin.passwordRequests.cardHint")}</span>
                </span>
              </label>

              {/* 2 — the password */}
              <fieldset disabled={!matched} className="space-y-2.5 rounded-2xl border border-forest/10 bg-cream-2/50 p-3.5 transition disabled:opacity-55">
                <legend className="sr-only">{t("admin.passwordRequests.password")}</legend>
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-forest">
                    <KeyRound size={14} className="text-gold" />
                    {t("admin.passwordRequests.password")}
                  </span>
                  {/* The field reads left to right whatever the page: the eye sits on its left, and the text starts past it. */}
                  <span className="relative block">
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      dir="ltr"
                      data-testid="password-request-password"
                      className={`${fieldCls} pl-11 text-start`}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={t("auth.togglePassword")}
                      className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-clay hover:text-forest"
                    >
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-forest/80">{t("auth.recover.repeat")}</span>
                  <input
                    type={show ? "text" : "password"}
                    value={again}
                    onChange={(e) => setAgain(e.target.value)}
                    autoComplete="new-password"
                    dir="ltr"
                    data-testid="password-request-again"
                    className={`${fieldCls} text-start ${mismatch ? "border-brick/60" : ""}`}
                  />
                  {mismatch && <span className="mt-1 block text-[11.5px] text-brick">{t("auth.recover.mismatch")}</span>}
                </label>
                <PasswordChecklist value={password} owner={owner} />
                <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-clay">
                  <Lock size={13} className="mt-0.5 shrink-0 text-sage" />
                  {t("admin.passwordRequests.passwordHint")}
                </p>
              </fieldset>
            </div>
          </div>

          {decide.isError && (
            <p role="alert" className="mt-3 rounded-xl border border-brick/25 bg-brick/[0.06] px-3 py-2 text-[12.5px] text-brick">
              {serverMessage(decide.error, t("apiError.unexpected"))}
            </p>
          )}

          {refusing ? (
            <div className="mt-4 rounded-2xl border border-brick/20 bg-brick/[0.05] p-4">
              <label className="flex items-center gap-2 text-[12.5px] font-bold text-forest" htmlFor={`password-reason-${r.id}`}>
                <XCircle size={15} className="text-brick" />
                {t("admin.activation.requests.reasonLabel")}
              </label>
              <textarea
                id={`password-reason-${r.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
                rows={3}
                placeholder={t("admin.activation.requests.reasonPlaceholder")}
                data-testid="password-request-reason"
                className="mt-2 w-full resize-y rounded-xl border border-forest/15 bg-cream-card px-3 py-2 text-[13px] text-forest outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              <CharCount value={reason} max={REASON_MAX} />
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setRefusing(false)} className="rounded-xl px-4 py-2 text-[12.5px] font-semibold text-clay transition hover:bg-forest/5">
                  {t("admin.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!reason.trim() || decide.isPending}
                  onClick={refuse}
                  data-testid="password-request-refuse-confirm"
                  className="inline-flex items-center gap-2 rounded-xl bg-brick px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(168,68,45,0.9)] transition hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
                >
                  {decide.isPending ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                  {t("admin.activation.requests.refuse")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefusing(true)}
                data-testid="password-request-refuse"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-brick/30 px-4 text-[13px] font-bold text-brick transition hover:border-brick/50 hover:bg-brick/[0.07]"
              >
                <XCircle size={16} />
                {t("admin.activation.requests.refuse")}
              </button>
              <button
                type="button"
                disabled={!ready || decide.isPending}
                onClick={approve}
                data-testid="password-request-approve"
                className="relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-linear-to-br from-forest to-forest-deep px-5 text-[13px] font-bold text-cream shadow-[0_12px_28px_-12px_rgba(38,66,61,0.85)] ring-1 ring-gold/35 transition hover:-translate-y-px hover:ring-gold/60 disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none"
              >
                {decide.isPending ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} className="text-gold-soft" />}
                {t("admin.passwordRequests.approve")}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function CardPhoto({ id, sentAt }: { id: string; sentAt: string }) {
  const { t } = useTranslation();
  return <PrivatePhoto q={usePasswordRequestPhoto(id, sentAt)} which="card" label={t("admin.activation.requests.card")} />;
}
