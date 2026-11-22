import { useTranslation } from "react-i18next";
import { Navigate, useSearchParams } from "react-router-dom";
import { IdCard, Inbox, KeyRound, ScrollText, Users, type LucideIcon } from "lucide-react";
import { useActivationRequests } from "../../api/activation.api";
import { usePasswordRequests } from "../../api/password-requests.api";
import { PasswordRequestsPanel } from "../activation/password-requests-panel";
import { ActivationView } from "../activation/activation-desk.page";
import { AdminAuditLogPage } from "../audit/audit-log.page";
import { AdminUsersPage } from "./Users.page";

/** What the page shows: the accounts — their activation, its requests or its desk — or what was done with them. */
type View = "users" | "requests" | "passwords" | "desk" | "audit";
const VIEWS: { view: View; icon: LucideIcon; label: string; hint: string }[] = [
  { view: "users", icon: Users, label: "dash.users", hint: "admin.usersHub.hint.users" },
  { view: "requests", icon: Inbox, label: "admin.activation.tabs.requests", hint: "admin.usersHub.hint.requests" },
  { view: "passwords", icon: KeyRound, label: "admin.passwordRequests.tab", hint: "admin.usersHub.hint.passwords" },
  { view: "desk", icon: IdCard, label: "admin.activation.tabs.desk", hint: "admin.usersHub.hint.desk" },
  { view: "audit", icon: ScrollText, label: "admin.audit.nav", hint: "admin.usersHub.hint.audit" },
];
const isView = (v: string | null): v is View => VIEWS.some((x) => x.view === v);

/**
 * «المستخدمون»: الحسابات — ومعها تفعيلها، إذ التفعيل حالٌ من أحوال الحساب،
 * وسجلّ ما فُعل بها ومنها. مفتاحٌ واحد في الأعلى بخمسة أجزاء — لا مفتاحٌ فوق
 * ألسنة: المستخدمون، وطلبات التوثيق، وطلبات كلمة المرور (كلٌّ بعدد ما ينتظر
 * منه)، ومكتب التفعيل، وسجلّ العمليات. وما يُعرض في الرابط
 * (`?view=requests|passwords|desk|audit`)، فيُرجع
 * إليه ويُرسل؛ وروابط الصفحتين القديمتين — التفعيل والسجلّ — تصل إلى مكانهما
 * هنا (ActivationRedirect، UsersViewRedirect).
 */
export function AdminUsersHubPage() {
  const { t, i18n } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const raw = sp.get("view");
  const view: View = isView(raw) ? raw : "users";
  const at = VIEWS.findIndex((v) => v.view === view);
  // What waits for a decision, on the switch itself: seen from whichever part is open.
  const waiting: Partial<Record<View, number>> = {
    requests: useActivationRequests().data?.total ?? 0,
    passwords: usePasswordRequests().data?.total ?? 0,
  };
  // The indicator slides under the part chosen — leftwards in a right-to-left page.
  const step = i18n.dir() === "rtl" ? -100 : 100;

  // Another part: a page of its own — nothing filtered or opened in one carries into the next.
  const show = (next: View) => next !== view && setSp(next === "users" ? {} : { view: next }, { replace: true });

  return (
    <div className="font-body">
      {/*
        Centred over the page, in the brand's green and gold: the three parts,
        the one chosen under a gold pill that slides there — and shines as it lands.
      */}
      <div className="forest-glow relative mx-auto mb-8 max-w-6xl overflow-hidden rounded-[1.75rem] p-2 shadow-[0_26px_60px_-30px_rgba(22,36,31,0.9)] ring-1 ring-white/[0.06]">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -top-20 start-1/4 size-64 rounded-full bg-gold/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 end-1/5 size-56 rounded-full bg-soft-sage/10 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute inset-x-20 top-0 h-px bg-linear-to-r from-transparent via-gold/60 to-transparent" />

        <div role="tablist" aria-label={t("admin.usersHub.label")} data-testid="users-switch" className="relative grid grid-cols-5">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 start-0 w-1/5 rounded-[1.3rem] bg-linear-to-br from-gold-soft via-gold to-[#a97a42] shadow-[0_14px_34px_-12px_rgba(193,150,90,0.8)] ring-1 ring-white/25 transition-transform duration-[650ms] ease-[cubic-bezier(0.34,1.3,0.64,1)]"
            style={{ transform: `translateX(${at * step}%)` }}
          >
            <span key={view} className="hub-shine" />
          </span>

          {VIEWS.map(({ view: v, icon: Icon, label, hint }) => {
            const on = v === view;
            return (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => show(v)}
                data-testid={`users-view-${v}`}
                className="group relative z-10 flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-[1.3rem] px-1 py-2.5 text-center sm:flex-row sm:gap-3 sm:px-3 sm:py-3 sm:text-start"
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl transition duration-300 sm:size-10 ${
                    on
                      ? "bg-[#1a312d]/15 text-[#1a312d] ring-1 ring-[#1a312d]/10"
                      : "bg-white/[0.06] text-gold-soft ring-1 ring-white/10 group-hover:bg-white/[0.1] group-hover:ring-gold/30"
                  }`}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span
                    className={`flex items-center justify-center gap-2 text-[11px] leading-tight font-bold transition-colors duration-300 sm:justify-start sm:text-[14px] ${
                      on ? "text-[#1a312d]" : "text-cream/80 group-hover:text-cream"
                    }`}
                  >
                    {/* Five to a phone's width: a name may take two lines there. */}
                    <span className="sm:truncate">{t(label)}</span>
                    {!!waiting[v] && (
                      // On a phone, on the part's corner — the name keeps the room it needs.
                      <span
                        className={`absolute top-1.5 end-1.5 grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-[11px] tabular-nums sm:static ${
                          on ? "bg-[#1a312d] text-gold-soft" : "bg-gold text-[#1a312d] shadow-[0_0_0_3px_rgba(212,175,117,0.18)]"
                        }`}
                      >
                        {waiting[v]}
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-0.5 hidden truncate text-[11.5px] transition-colors duration-300 lg:block ${
                      on ? "text-[#1a312d]/70" : "text-cream/50"
                    }`}
                  >
                    {t(hint)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Each part comes in gently when chosen. */}
      <div key={view} role="tabpanel" className="animate-[fadeUp_0.35s_cubic-bezier(0.22,1,0.36,1)_both]">
        {view === "users" ? (
          <AdminUsersPage />
        ) : view === "audit" ? (
          <AdminAuditLogPage />
        ) : view === "passwords" ? (
          <PasswordRequestsPanel />
        ) : (
          <ActivationView view={view} />
        )}
      </div>
    </div>
  );
}

/**
 * A page that was its own once — `/admin/audit-log` — and is a part here now:
 * its links (a security alert's, a bookmark) lead to it, with what they carried
 * (`?kind=failed`).
 */
export function UsersViewRedirect({ view }: { view: Exclude<View, "users"> }) {
  const [sp] = useSearchParams();
  const next = new URLSearchParams(sp);
  next.set("view", view);
  return <Navigate to={`../users?${next}`} replace />;
}
