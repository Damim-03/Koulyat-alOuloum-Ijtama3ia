import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownUp,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Clock,
  FilterX,
  GraduationCap,
  IdCard,
  ImageOff,
  Inbox,
  Loader2,
  Maximize2,
  ScanFace,
  ScanLine,
  Search,
  SearchX,
  ShieldAlert,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { Select } from "../../../../components/ui/select";
import { StudentProfileView } from "./student-profile";
import { useDates } from "../../../../hooks/use-dates";
import { serverMessage } from "../../../../lib/api/error";
import { REASON_MAX } from "../../../../lib/limits";
import { CharCount } from "../../../../components/ui/char-count";
import { LoadingArea } from "../../../../components/ui/loading-area";
import { ErrorRetry } from "../../../../components/ui/error-retry";
import {
  useActivationPhoto,
  useActivationRequests,
  useDecideActivation,
  type ActivationRequestItem,
} from "../../api/activation.api";

/**
 * طلبات التوثيق (Backend modules/activation): صورة البطاقة، وصورة الطالب وهو
 * يمسكها. يقارن المسؤول الوجه بالصورة المطبوعة على البطاقة — إنسانٌ هو صاحبها،
 * لا برنامج — فيقبل فيُوثَّق الحساب، أو يرفض بسببٍ يقرؤه الطالب.
 *
 * وكلّ طلبٍ يُطوى: رأسه وحده — من هو، وما قيل في رمز بطاقته، ومتى أرسل — حتى
 * يُفتح. الأوّل مفتوح، فإذا قُضي فيه انفتح الذي بعده. وصورتا طلبٍ مطويّ لا
 * تُجلبان حتى يُفتح.
 *
 * والصورتان خاصّتان: تُجلبان بجلسة المسؤول لا برابط، ولا تُحفظان في المتصفّح،
 * وتُحذفان من الخادم عند القرار.
 */
type Qr = "all" | "match" | "other" | "unread";

/** What the filter keeps: everything it says, all at once. */
function keep(
  r: ActivationRequestItem,
  f: { search: string; qr: Qr; spec: string },
): boolean {
  const words = f.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [r.firstName, r.lastName, r.firstNameLatin, r.lastNameLatin, r.registrationNumber].join(" ").toLowerCase();
  if (words.some((w) => !haystack.includes(w))) return false;
  if (f.qr === "match" && r.qrMatches !== true) return false;
  if (f.qr === "other" && r.qrMatches !== false) return false;
  if (f.qr === "unread" && (r.qrMatches !== null || !r.photos.card)) return false;
  if (f.spec && r.specialization.name !== f.spec) return false;
  return true;
}

/** A request sent again is a new one to review: nothing ticked — nor opened — carries over. */
const keyOf = (r: ActivationRequestItem) => `${r.id}-${r.sentAt}`;

export function ActivationRequestsPanel() {
  const { t } = useTranslation();
  const q = useActivationRequests();
  const [search, setSearch] = useState("");
  const [qr, setQr] = useState<Qr>("all");
  const [spec, setSpec] = useState("");
  const [newest, setNewest] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  // Opened or folded by hand; the rest as they come — the first open.
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  if (q.isLoading) return <LoadingArea className="py-16" />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => q.refetch()} />;
  if (!q.data.items.length) {
    return (
      <div className="forest-glow relative grid min-h-72 place-items-center overflow-hidden rounded-3xl text-center text-cream" data-testid="requests-empty">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
        <div className="pointer-events-none absolute -top-20 start-1/4 size-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <span className="mx-auto mb-3 grid size-16 place-items-center rounded-3xl border border-gold/30 bg-gold/10 text-gold-soft">
            <Inbox size={28} strokeWidth={1.7} />
          </span>
          <p className="font-serif text-[18px] font-bold">{t("admin.activation.requests.empty")}</p>
          <p className="mt-1 text-[12.5px] text-cream/65">{t("admin.activation.requests.emptyHint")}</p>
        </div>
      </div>
    );
  }

  const all = q.data.items;
  const specs = [...new Set(all.map((r) => r.specialization.name))].sort();
  const shown = all
    .filter((r) => keep(r, { search, qr, spec }))
    .sort((a, b) => (newest ? b.sentAt.localeCompare(a.sentAt) : a.sentAt.localeCompare(b.sentAt)));
  const filtered = !!(search || qr !== "all" || spec);
  const isOpen = (r: ActivationRequestItem, i: number) => opened[keyOf(r)] ?? i === 0;
  const allOpen = shown.every(isOpen);
  const reset = () => {
    setSearch("");
    setQr("all");
    setSpec("");
  };

  return (
    <div className="space-y-4">
      <section
        className="relative overflow-hidden rounded-3xl border border-forest/10 bg-cream-card p-4 shadow-[0_10px_40px_-24px_rgba(38,66,61,0.45)] sm:p-5"
        data-testid="requests-filter"
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-gold/60 to-transparent" />
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[14rem] flex-1">
            <Search size={17} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gold" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.activation.requests.filter.search")}
              aria-label={t("admin.activation.requests.filter.search")}
              data-testid="requests-search"
              className="h-11 w-full rounded-2xl border border-forest/12 bg-cream-2 ps-10 pe-3 text-[13px] text-forest outline-none transition placeholder:text-clay/60 focus:border-gold focus:bg-cream-card focus:ring-4 focus:ring-gold/15"
            />
          </label>
          <ToolButton onClick={() => setNewest((n) => !n)} testId="requests-sort" icon={ArrowDownUp}>
            {t(newest ? "admin.activation.requests.filter.newest" : "admin.activation.requests.filter.oldest")}
          </ToolButton>
          {shown.length > 1 && (
            <ToolButton
              onClick={() => setOpened(Object.fromEntries(shown.map((r) => [keyOf(r), !allOpen])))}
              testId="requests-fold-all"
              icon={allOpen ? ChevronsDownUp : ChevronsUpDown}
            >
              {t(allOpen ? "admin.activation.requests.collapseAll" : "admin.activation.requests.expandAll")}
            </ToolButton>
          )}
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Select
            filter
            icon={ScanLine}
            value={qr === "all" ? "" : qr}
            onChange={(v) => setQr((v || "all") as Qr)}
            aria-label={t("admin.activation.requests.filter.qr")}
            options={(["all", "match", "other", "unread"] as const).map((v) => ({
              value: v === "all" ? "" : v,
              label: t(`admin.activation.requests.filter.qrs.${v}`),
            }))}
          />
          <Select
            filter
            icon={GraduationCap}
            value={spec}
            onChange={setSpec}
            aria-label={t("admin.activation.finder.specialization")}
            options={[{ value: "", label: t("admin.activation.finder.allSpecs") }, ...specs.map((s) => ({ value: s, label: s }))]}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px]">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.07] px-3 py-1 font-bold text-forest"
            data-testid="requests-shown"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-gold" />
            {t("admin.activation.requests.filter.shown", { shown: shown.length, total: all.length })}
          </span>
          {filtered && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 font-semibold text-gold transition hover:text-gold-soft">
              <FilterX size={14} />
              {t("admin.activation.finder.reset")}
            </button>
          )}
        </div>
      </section>

      {shown.length ? (
        shown.map((r, i) => (
          <RequestCard
            key={keyOf(r)}
            r={r}
            open={isOpen(r, i)}
            onToggle={() => setOpened((o) => ({ ...o, [keyOf(r)]: !isOpen(r, i) }))}
            onProfile={() => setProfile(r.id)}
          />
        ))
      ) : (
        <div className="grid min-h-40 place-items-center rounded-3xl border border-dashed border-forest/15 text-center text-clay" data-testid="requests-no-match">
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

/** A tool beside the search: the sort, folding them all. */
export function ToolButton({ onClick, testId, icon: Icon, children }: { onClick: () => void; testId: string; icon: typeof Clock; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-forest/12 bg-cream-2 px-3.5 text-[12px] font-bold text-forest transition hover:border-gold/45 hover:bg-cream-card"
    >
      <Icon size={15} className="text-gold" />
      {children}
    </button>
  );
}

/** The student's whole file, over the page — closed by the button, Escape or a click outside. */
export function ProfileDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={t("admin.activation.requests.profile")} data-testid="profile-drawer">
      <button type="button" aria-label={t("admin.close")} onClick={onClose} className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]" />
      <div className="relative h-full w-full max-w-5xl overflow-y-auto bg-cream p-4 shadow-[0_0_60px_rgba(0,0,0,0.35)] animate-[fadeUp_0.25s_both] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-serif text-[18px] font-bold text-forest">{t("admin.activation.requests.profile")}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("admin.close")}
            className="grid size-10 place-items-center rounded-xl border border-forest/12 bg-cream-card text-forest transition hover:border-gold/40"
          >
            <X size={18} />
          </button>
        </div>
        <StudentProfileView id={id} />
      </div>
    </div>
  );
}

const CHIP = {
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-300",
  red: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300",
};

/** The edge of a request, in the colour of what its card's code said. */
const ACCENT = {
  green: "from-emerald-400 to-emerald-600",
  amber: "from-amber-300 to-amber-500",
  red: "from-red-400 to-red-600",
};

export function Chip({ tone, icon: Icon, children }: { tone: keyof typeof CHIP; icon: typeof Clock; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold ${CHIP[tone]}`}>
      <Icon size={13} className="shrink-0" />
      {children}
    </span>
  );
}

/** What the card's code said — or that there are no photos — as a chip, and its colour. */
function qrSaid(r: ActivationRequestItem, t: ReturnType<typeof useTranslation>["t"]): { tone: keyof typeof CHIP; chip: ReactNode } {
  if (!r.photos.card && !r.photos.selfie)
    return { tone: "red", chip: <Chip tone="red" icon={ImageOff}>{t("admin.activation.requests.noPhotos")}</Chip> };
  if (!r.photos.card) return { tone: "amber", chip: null };
  if (r.qrMatches === true) return { tone: "green", chip: <Chip tone="green" icon={CheckCircle2}>{t("admin.activation.requests.qrMatch")}</Chip> };
  if (r.qrMatches === false)
    return { tone: "red", chip: <Chip tone="red" icon={AlertTriangle}>{t("admin.activation.requests.qrOther", { number: r.qrNumber })}</Chip> };
  return { tone: "amber", chip: <Chip tone="amber" icon={ScanLine}>{t("admin.activation.requests.qrUnread")}</Chip> };
}

/**
 * The student's initial: the first letter of the Arabic name — one, since two
 * Arabic letters side by side join into a word — or of each Latin name.
 */
export function initials(r: Pick<ActivationRequestItem, "firstName" | "lastName" | "firstNameLatin" | "lastNameLatin">): string {
  const first = (s?: string | null) => [...(s ?? "").trim()][0] ?? "";
  if (r.firstName || r.lastName) return first(r.firstName) || first(r.lastName);
  return (first(r.firstNameLatin) + first(r.lastNameLatin)).toUpperCase();
}

function RequestCard({
  r,
  open,
  onToggle,
  onProfile,
}: {
  r: ActivationRequestItem;
  open: boolean;
  onToggle: () => void;
  onProfile: () => void;
}) {
  const { t } = useTranslation();
  const { fmtDate } = useDates();
  const decide = useDecideActivation();
  // Kept here, not in the folding part: folded and opened again, nothing ticked or typed is lost.
  const [matched, setMatched] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
  const latin = [r.firstNameLatin, r.lastNameLatin].filter(Boolean).join(" ");
  const said = qrSaid(r, t);
  const body = `request-body-${r.id}`;

  // The card alone, as every request now has. One from before has the second photo too (the
  // student holding the card) — shown, and the face compared; one older still may have neither.
  const both = r.photos.card && r.photos.selfie;
  const cardOnly = r.photos.card && !r.photos.selfie;
  const shown = (["card", "selfie"] as const).filter((w) => w === "card" || r.photos.selfie);
  const done = (key: string) => () => toast.success(t(key, { name: name || latin || r.registrationNumber }));
  const approve = () =>
    decide.mutate(
      { id: r.id, sentAt: r.sentAt, decision: "approve" },
      { onSuccess: done("admin.activation.requests.verified") },
    );
  const refuse = () =>
    decide.mutate(
      { id: r.id, sentAt: r.sentAt, decision: "reject", reason: reason.trim() },
      { onSuccess: done("admin.activation.requests.refused") },
    );

  return (
    <article
      className={`group/request relative overflow-hidden rounded-3xl border bg-cream-card transition duration-300 ${
        open
          ? "border-gold/30 shadow-[0_24px_60px_-28px_rgba(38,66,61,0.55)]"
          : "border-forest/10 shadow-[0_8px_30px_-20px_rgba(38,66,61,0.35)] hover:-translate-y-px hover:border-gold/25 hover:shadow-[0_16px_40px_-22px_rgba(38,66,61,0.45)]"
      }`}
      data-testid="activation-request"
      data-open={open}
    >
      {/* The edge in the colour of what the card's code said; a hairline of gold on top. */}
      <span aria-hidden className={`pointer-events-none absolute inset-y-0 start-0 w-1 bg-linear-to-b ${ACCENT[said.tone]}`} />
      <span aria-hidden className="pointer-events-none absolute inset-x-16 top-0 h-px bg-linear-to-r from-transparent via-gold/55 to-transparent" />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={body}
        data-testid="request-toggle"
        className="flex w-full flex-wrap items-start gap-x-4 gap-y-3 px-5 py-4 text-start transition hover:bg-gold/[0.035] sm:items-center sm:px-6"
      >
        {/* On a phone: who, and the arrow, in one row — what was said in the next, under the name. */}
        <span className="relative order-1 grid size-12 shrink-0 place-items-center rounded-2xl bg-forest font-serif text-[21px] font-bold text-gold-soft shadow-[0_10px_24px_-12px_rgba(22,36,31,0.9)] ring-1 ring-gold/30">
          {initials(r) || <UserRound size={20} />}
          {r.status === "active" ? null : (
            <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-red-500 text-white ring-2 ring-cream-card">
              <ShieldAlert size={11} />
            </span>
          )}
        </span>

        <span className="order-2 min-w-0 flex-1 sm:basis-56">
          <span className="block truncate font-serif text-[18.5px] leading-tight font-bold text-forest" dir="auto">
            {name || latin}
          </span>
          {name && latin && (
            // Left to right inside, but placed where the name is — not pushed to the far side.
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
          {said.chip}
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
        <div id={body} className="animate-[fadeUp_0.3s_both] px-5 pb-5 sm:px-6 sm:pb-6" data-testid="request-body">
          <div aria-hidden className="mb-4 h-px bg-linear-to-r from-transparent via-forest/12 to-transparent" />

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-[12.5px] font-bold text-forest/80">
              <ScanFace size={15} className="text-gold" />
              {t(both ? "admin.activation.requests.compare" : cardOnly ? "admin.activation.requests.checkCard" : "admin.activation.requests.photos")}
            </p>
            <button
              type="button"
              onClick={onProfile}
              data-testid="request-profile"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gold/35 bg-gold/[0.08] px-3 py-1.5 text-[12px] font-bold text-forest transition hover:border-gold/60 hover:bg-gold/15"
            >
              <UserRound size={14} className="text-gold" />
              {t("admin.activation.requests.profile")}
            </button>
          </div>

          <div className={`grid grid-cols-1 gap-3 ${shown.length > 1 ? "md:grid-cols-[1.3fr_1fr]" : ""}`}>
            {shown.map((which) =>
              r.photos[which] ? (
                <Photo key={which} id={r.id} sentAt={r.sentAt} which={which} label={t(`admin.activation.requests.${which}`)} />
              ) : (
                <NoPhoto key={which} which={which} label={t(`admin.activation.requests.${which}`)} />
              ),
            )}
          </div>

          {decide.isError && (
            <p role="alert" className="mt-3 rounded-xl border border-brick/25 bg-brick/[0.06] px-3 py-2 text-[12.5px] text-brick">
              {serverMessage(decide.error, t("apiError.unexpected"))}
            </p>
          )}

          {refusing ? (
            <div className="mt-4 rounded-2xl border border-brick/20 bg-brick/[0.05] p-4">
              <label className="flex items-center gap-2 text-[12.5px] font-bold text-forest" htmlFor={`reason-${r.id}`}>
                <XCircle size={15} className="text-brick" />
                {t("admin.activation.requests.reasonLabel")}
              </label>
              <textarea
                id={`reason-${r.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
                rows={3}
                placeholder={t("admin.activation.requests.reasonPlaceholder")}
                data-testid="request-reason"
                className="mt-2 w-full resize-y rounded-xl border border-forest/15 bg-cream-card px-3 py-2 text-[13px] text-forest outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15"
              />
              <CharCount value={reason} max={REASON_MAX} />
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRefusing(false)}
                  className="rounded-xl px-4 py-2 text-[12.5px] font-semibold text-clay transition hover:bg-forest/5"
                >
                  {t("admin.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!reason.trim() || decide.isPending}
                  onClick={refuse}
                  data-testid="request-refuse-confirm"
                  className="inline-flex items-center gap-2 rounded-xl bg-brick px-4 py-2 text-[12.5px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(168,68,45,0.9)] transition hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
                >
                  {decide.isPending ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                  {t("admin.activation.requests.refuse")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-stretch gap-3">
              <label
                className={`flex min-w-0 flex-1 basis-80 cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
                  matched ? "border-emerald-500/40 bg-emerald-500/[0.08]" : "border-gold/35 bg-gold/[0.06] hover:bg-gold/10"
                }`}
              >
                <input
                  type="checkbox"
                  checked={matched}
                  onChange={(e) => setMatched(e.target.checked)}
                  data-testid="request-matched"
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
                  <span className="block text-[13px] font-bold text-forest">
                    {t(
                      both
                        ? "admin.activation.requests.matchLabel"
                        : cardOnly
                          ? "admin.activation.requests.cardLabel"
                          : "admin.activation.requests.identityLabel",
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-clay">
                    {t(
                      both
                        ? "admin.activation.requests.matchHint"
                        : cardOnly
                          ? "admin.activation.requests.cardHint"
                          : "admin.activation.requests.identityHint",
                    )}
                  </span>
                </span>
              </label>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRefusing(true)}
                  data-testid="request-refuse"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-brick/30 px-4 text-[13px] font-bold text-brick transition hover:border-brick/50 hover:bg-brick/[0.07]"
                >
                  <XCircle size={16} />
                  {t("admin.activation.requests.refuse")}
                </button>
                <button
                  type="button"
                  disabled={!matched || decide.isPending}
                  onClick={approve}
                  data-testid="request-approve"
                  className="relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-xl bg-linear-to-br from-forest to-forest-deep px-5 text-[13px] font-bold text-cream shadow-[0_12px_28px_-12px_rgba(38,66,61,0.85)] ring-1 ring-gold/35 transition hover:-translate-y-px hover:ring-gold/60 disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none"
                >
                  {decide.isPending ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} className="text-gold-soft" />}
                  {t("admin.activation.requests.approveVerify")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

const FRAME = "relative h-64 overflow-hidden rounded-2xl sm:h-80";

/** Four gold corners on a photo's frame. */
function Corners() {
  const corner = "pointer-events-none absolute size-5 border-gold-soft/70";
  return (
    <>
      <span aria-hidden className={`${corner} start-3 top-3 rounded-ss-lg border-s-2 border-t-2`} />
      <span aria-hidden className={`${corner} end-3 top-3 rounded-se-lg border-e-2 border-t-2`} />
      <span aria-hidden className={`${corner} start-3 bottom-3 rounded-es-lg border-s-2 border-b-2`} />
      <span aria-hidden className={`${corner} end-3 bottom-3 rounded-ee-lg border-e-2 border-b-2`} />
    </>
  );
}

/** What a photo is, over its bottom corner. */
function Caption({ which, label }: { which: "card" | "selfie"; label: string }) {
  const Icon = which === "card" ? IdCard : ScanFace;
  return (
    <figcaption className="pointer-events-none absolute start-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11.5px] font-semibold text-white backdrop-blur-md">
      <Icon size={13} className="text-gold-soft" />
      {label}
    </figcaption>
  );
}

/** In place of a photo the student did not send. */
function NoPhoto({ which, label }: { which: "card" | "selfie"; label: string }) {
  const { t } = useTranslation();
  return (
    <figure className={`${FRAME} border border-dashed border-forest/20 bg-cream-2/60`} data-testid="request-no-photo">
      <div className="grid size-full place-items-center text-center text-clay">
        <span>
          <ImageOff size={26} className="mx-auto mb-1.5 text-forest/30" />
          <span className="text-[12px] font-semibold">{t("admin.activation.requests.notSent")}</span>
        </span>
      </div>
      <Caption which={which} label={label} />
    </figure>
  );
}

/** A private photo of a verification request. */
function Photo({ id, sentAt, which, label }: { id: string; sentAt: string; which: "card" | "selfie"; label: string }) {
  return <PrivatePhoto q={useActivationPhoto(id, sentAt, which)} which={which} label={label} />;
}

/**
 * A private photo — fetched with the session by the query given (an address
 * the page can show), enlarged on a click.
 */
export function PrivatePhoto({ q, which, label }: { q: { data?: string; isError: boolean }; which: "card" | "selfie"; label: string }) {
  const { t } = useTranslation();
  const url = q.data;
  const [zoom, setZoom] = useState(false);

  // The address of the picture lives as long as the picture shown.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  // Escape closes the enlarged photo, as a click does.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoom(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  return (
    <figure className={`${FRAME} group/photo bg-forest-deep ring-1 ring-black/10`}>
      {/* A soft light behind the photo, so a dark one does not sink into the frame. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(212,175,117,0.12),transparent_65%)]" />
      <button
        type="button"
        onClick={() => url && setZoom(true)}
        disabled={!url}
        aria-label={t("admin.activation.requests.enlarge", { what: label })}
        className="relative block size-full cursor-zoom-in p-3 disabled:cursor-default"
      >
        {url ? (
          <img
            src={url}
            alt={label}
            data-testid={`request-photo-${which}`}
            className="size-full rounded-lg object-contain transition duration-500 group-hover/photo:scale-[1.02]"
          />
        ) : q.isError ? (
          <span className="grid size-full place-items-center text-[12px] text-cream/75">{t("admin.activation.requests.photoFailed")}</span>
        ) : (
          <span className="grid size-full place-items-center">
            <Loader2 size={20} className="animate-spin text-cream/70" />
          </span>
        )}
      </button>
      <Corners />
      <Caption which={which} label={label} />
      {url && (
        <span
          aria-hidden
          className="pointer-events-none absolute end-3 bottom-3 grid size-8 place-items-center rounded-full border border-white/15 bg-black/55 text-white opacity-0 backdrop-blur-md transition group-hover/photo:opacity-100"
        >
          <Maximize2 size={14} />
        </span>
      )}

      {zoom && url && (
        <div
          role="dialog"
          aria-label={label}
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/85 p-4 backdrop-blur-sm animate-[fade_0.2s_both]"
        >
          <img src={url} alt={label} className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-[0_30px_80px_rgba(0,0,0,0.6)]" />
          <p className="absolute inset-x-0 bottom-5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-4 py-1.5 text-[12.5px] font-semibold text-white">
              {label}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label={t("admin.close")}
            className="absolute end-4 top-4 grid size-10 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </figure>
  );
}
