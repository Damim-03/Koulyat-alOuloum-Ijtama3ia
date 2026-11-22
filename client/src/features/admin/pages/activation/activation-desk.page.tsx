import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router-dom";
import { BadgeCheck, IdCard, Inbox, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";
import { useActivationRequests, useDeskSettings } from "../../api/activation.api";
import { ActivationRequestsPanel } from "./requests-panel";
import { DeskPanel } from "./desk-panel";

/** The two views of activation, in «المستخدمون» (pages/users/users-hub). */
export type ActivationViewName = "requests" | "desk";

/**
 * تفعيل حسابات الطلبة — جزءٌ من صفحة المستخدمين، بمفتاحها (users-hub):
 *
 * - **طلبات التوثيق** (Backend modules/activation): صوّر الطالب بطاقته ووجهه
 *   وهو يمسكها؛ فيقارن المسؤول الوجه بصورة البطاقة — إنسانٌ هو صاحبها، لا
 *   برنامج — فيقبل أو يرفض بسبب. إليها يقود إشعار كلّ طلبٍ جديد.
 * - **مكتب التفعيل** (Backend modules/admin/activation-desk): يُعثر على الطالب
 *   بالبطاقة أو الرقم أو الاسم أو الفلتر، فيظهر ملفّه كاملاً — بياناته ومساره
 *   ومواضيعه ونشاطه.
 *
 * وفي الرأس أين يقف الطلبة: كلّ رقمٍ زرٌّ يفتح ما يعدّه.
 */
export function ActivationView({ view }: { view: ActivationViewName }) {
  const { t } = useTranslation();
  const [, setSp] = useSearchParams();
  const settings = useDeskSettings();
  const requests = useActivationRequests();
  const s = settings.data;
  const c = s?.counts;
  const waiting = requests.data?.total ?? c?.pendingRequests ?? 0;
  const share = (n: number) => (c?.students ? Math.round((n / c.students) * 100) : 0);
  const activated = c ? c.students - c.notActivated : 0;

  const go = (next: ActivationViewName, filter?: Record<string, string>) => setSp({ view: next, ...filter }, { replace: true });

  return (
    <div className="font-body" data-testid="activation-desk-page">
      <header className="forest-glow relative mb-6 overflow-hidden rounded-3xl text-cream shadow-[0_18px_50px_-20px_rgba(22,36,31,0.6)]">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -top-24 -end-16 size-96 rounded-full bg-gold/12 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 start-1/3 size-72 rounded-full bg-soft-sage/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-gold/50 to-transparent" />

        <div className="relative px-6 pt-7 pb-6 sm:px-8 lg:px-10">
          <div className="flex flex-wrap items-center gap-5">
            <span className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-gold to-gold-soft text-[#1a312d] shadow-[0_14px_30px_-12px_rgba(193,150,90,0.9)]">
              <IdCard size={28} />
            </span>
            <div className="min-w-0 flex-1 basis-72">
              <h1 className="font-serif text-[28px] leading-tight font-bold lg:text-[32px]">{t("admin.activation.title")}</h1>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-cream/70">{t("admin.activation.subtitle")}</p>
            </div>
            {s && (
              <div className="flex flex-wrap gap-2" data-testid="desk-settings">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold backdrop-blur-sm ${
                    s.required ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200" : "border-amber-300/30 bg-amber-400/15 text-amber-200"
                  }`}
                >
                  {s.required ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                  {t(s.required ? "admin.activation.required" : "admin.activation.notRequired")}
                </span>
              </div>
            )}
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="desk-stats">
            <Stat icon={Inbox} tone="text-sky-300 bg-sky-400/15" label={t("admin.activation.stats.waiting")} value={waiting} onClick={() => go("requests")} />
            <Stat
              icon={ShieldAlert}
              tone="text-amber-300 bg-amber-400/15"
              label={t("admin.activation.stats.notActivated")}
              value={c?.notActivated ?? "—"}
              hint={c ? t("admin.activation.stats.ofStudents", { count: c.students }) : undefined}
              onClick={() => go("desk", { state: "notActivated" })}
            />
            <Stat
              icon={ShieldCheck}
              tone="text-teal-300 bg-teal-400/15"
              label={t("admin.activation.stats.activated")}
              value={c ? activated : "—"}
              hint={c ? t("admin.activation.stats.share", { p: share(activated) }) : undefined}
              bar={c ? share(activated) : undefined}
              barTone="from-teal-300 to-teal-500"
              onClick={() => go("desk", { state: "activated" })}
            />
            <Stat
              icon={BadgeCheck}
              tone="text-emerald-300 bg-emerald-400/15"
              label={t("admin.activation.stats.verified")}
              value={c?.verified ?? "—"}
              hint={c ? t("admin.activation.stats.share", { p: share(c.verified) }) : undefined}
              bar={c ? share(c.verified) : undefined}
              onClick={() => go("desk", { state: "verified" })}
            />
          </div>
        </div>
      </header>

      {view === "requests" ? <ActivationRequestsPanel /> : <DeskPanel settings={s} />}
    </div>
  );
}

/**
 * `/admin/activation` was a page of its own: its links — notifications already
 * sent, bookmarks — lead to its place in «المستخدمون», with what they carried
 * (the student open, the filter). `?tab=students` (once `desk`) was the desk.
 */
export function ActivationRedirect() {
  const [sp] = useSearchParams();
  const tab = sp.get("tab");
  const next = new URLSearchParams(sp);
  next.delete("tab");
  next.set("view", tab === "students" || tab === "desk" ? "desk" : "requests");
  return <Navigate to={`../users?${next}`} replace />;
}

/** A number in the header — and a way to the students it counts. */
function Stat({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  bar,
  barTone = "from-emerald-300 to-emerald-500",
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: ReactNode;
  hint?: string;
  bar?: number;
  barTone?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-start backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-gold/35 hover:bg-white/[0.09]"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-cream/70">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl transition group-hover:scale-110 ${tone}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 font-serif text-[30px] leading-tight font-bold text-cream tabular-nums">{value}</p>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full bg-linear-to-l ${barTone}`} style={{ width: `${bar}%` }} />
        </div>
      )}
      {hint && <p className="mt-1.5 truncate text-[11px] text-cream/55">{hint}</p>}
    </button>
  );
}
