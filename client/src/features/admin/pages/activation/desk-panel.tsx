import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { serverMessage } from "../../../../lib/api/error";
import { readRegistration, typedByHand } from "../../../../lib/read-registration";
import { DESK_STATES, useDeskLookup, type DeskSettings, type DeskState } from "../../api/activation.api";
import { DeskFilterBar, StudentList, type FinderFilters } from "./student-finder";
import { StudentProfileView } from "./student-profile";

/**
 * «الطلبة» (Backend modules/admin/activation-desk): يُعثر على الطالب — بمسح
 * بطاقته، أو برقمه، أو باسمه، أو بفلترٍ على حاله وتخصّصه وسنته — فيظهر ملفّه
 * كاملاً بجانب القائمة: بياناته ومساره ومواضيعه ونشاطه.
 *
 * والقائمة وحدها تملأ العرض، بأعمدتها، حتى يُفتح ملفّ: فتضيق إلى جانبه، ثمّ
 * يدخل الملفّ من جهته. ويُغلق بزرّه أو بـEsc: فيخرج، وتعود القائمة إلى العرض
 * كلّه. وعلى الهاتف الملفّ وحده، وإغلاقه رجوعٌ إلى القائمة.
 *
 * والفلتر والطالب المفتوح في الرابط (`?q=&state=&spec=&year=&page=&student=`):
 * يُرجع إليه، ويُرسل.
 */
export function DeskPanel({ settings }: { settings?: DeskSettings }) {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const lookup = useDeskLookup();
  const [missing, setMissing] = useState<string | null>(null);
  const state = sp.get("state") as DeskState | null;
  const filters: FinderFilters = {
    q: sp.get("q") ?? "",
    state: state && DESK_STATES.includes(state) ? state : "all",
    specializationId: sp.get("spec") ?? "",
    academicYearId: sp.get("year") ?? "",
    page: Math.max(1, Number(sp.get("page")) || 1),
  };
  const selected = sp.get("student");

  // Each write builds on the newest URL. `setSearchParams(prev => …)` hands over the params this
  // render saw, not the newest: the pause after a typed number and the lookup's answer write
  // moments apart, and the later one put back a URL without the student it had just opened.
  const latest = useRef(sp);
  useLayoutEffect(() => {
    latest.current = sp;
  }, [sp]);
  const write = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(latest.current);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    latest.current = next;
    setSp(next, { replace: true });
  };

  const onFilters = (n: Partial<FinderFilters>) =>
    write({
      ...("q" in n ? { q: n.q || null } : {}),
      ...("state" in n ? { state: n.state === "all" ? null : n.state! } : {}),
      ...("specializationId" in n ? { spec: n.specializationId || null } : {}),
      ...("academicYearId" in n ? { year: n.academicYearId || null } : {}),
      ...("page" in n ? { page: n.page && n.page > 1 ? String(n.page) : null } : {}),
    });
  const select = (id: string) => {
    setMissing(null);
    write({ student: id });
  };

  /** A registration number — typed, pasted as the card's link, or scanned: that student's file. */
  const open = (text: string, fromCard: boolean) => {
    setMissing(null);
    const reg = readRegistration(text);
    if (!reg) {
      if (fromCard) setMissing(t("admin.activation.read.unread"));
      return false;
    }
    lookup.mutate(reg, {
      // The list beside the file shows that one student: their number is the search.
      onSuccess: (s) => {
        setMissing(null);
        write({ student: s.id, q: reg, page: null });
      },
      // Typed: a number no student has is a filter on numbers. Scanned: it is said.
      onError: (e) => (fromCard ? setMissing(serverMessage(e, t("apiError.unexpected"))) : onFilters({ q: reg, page: 1 })),
    });
    return true;
  };

  // ── A file open, or on its way: the list makes room for it ──
  const opened = !!selected || lookup.isPending;
  const area = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // The file comes in once the list has narrowed — not squeezed into the gap while it does.
  const [roomy, setRoomy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!opened) return;
    // Opened far down a long list: up to the file.
    const top = area.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) area.current?.scrollIntoView?.({ block: "start", behavior: still() ? "auto" : "smooth" });
    // Beside the list, the file waits for it to finish narrowing — told by the list itself,
    // or, should that never come, a moment after it should have. Alone (a phone), at once.
    const el = list.current;
    const beside = !!el && getComputedStyle(el).display !== "none" && getComputedStyle(area.current ?? el).flexDirection === "row";
    const ready = () => setRoomy(true);
    const narrowed = (e: TransitionEvent) => e.target === el && e.propertyName === "flex-basis" && ready();
    el?.addEventListener("transitionend", narrowed);
    const timer = setTimeout(ready, still() || !beside ? 0 : LAYOUT_MS + 350);
    return () => {
      el?.removeEventListener("transitionend", narrowed);
      clearTimeout(timer);
      setRoomy(false);
    };
  }, [opened]);

  /** The file slides out, then the list grows back to the whole width. */
  const close = () => {
    if (leaving) return;
    if (still()) return write({ student: null });
    setLeaving(true);
    setTimeout(() => {
      setLeaving(false);
      write({ student: null });
    }, LEAVE_MS);
  };
  // Escape closes it too — unless a list being chosen from, or a dialog, has it.
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape" || e.defaultPrevented || !selected) return;
    if (document.querySelector('[aria-modal="true"], [role="listbox"]')) return;
    close();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onEscape(e);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-5">
      <DeskFilterBar
        filters={filters}
        onFilters={onFilters}
        counts={settings?.counts}
        selectedId={selected}
        // A card's link typed in by a QR reader is a card: a number nobody has is said, not searched.
        onTyped={(text) => open(text, !!readRegistration(text) && !typedByHand(text))}
        onScan={(text) => open(text, true)}
      />
      {missing && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-brick/8 px-4 py-3 text-[12.5px] text-brick ring-1 ring-brick/20">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {missing}
        </p>
      )}

      {/* The list alone, the whole width; a file open, the list beside it — on a phone, the file alone. */}
      <div ref={area} className="flex scroll-mt-24 flex-col gap-5 overflow-x-clip xl:flex-row xl:items-start">
        <div
          ref={list}
          data-testid="desk-list"
          data-wide={!opened}
          className={`min-w-0 transition-[flex-basis] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] xl:shrink-0 ${
            opened ? "hidden xl:sticky xl:top-20 xl:block xl:basis-[24rem]" : "xl:basis-full"
          }`}
        >
          <StudentList filters={filters} onFilters={onFilters} selectedId={selected} onSelect={select} wide={!opened} />
        </div>

        {opened && (
          <div className={`desk-file min-w-0 flex-1 ${leaving ? "desk-file-out" : ""}`} data-testid="desk-file">
            {/* A number paused on while typing is looked up quietly: the open file stays until another is found. */}
            {selected && roomy ? (
              <div key={selected} className="desk-file-in relative">
                <button
                  type="button"
                  onClick={close}
                  title={`${t("admin.activation.profile.close")} (Esc)`}
                  data-testid="desk-close"
                  className="absolute end-3 top-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-full bg-forest-deep/60 px-3 text-[12px] font-bold text-cream ring-1 ring-white/15 backdrop-blur-md transition hover:bg-forest-deep/80 hover:text-gold-soft hover:ring-gold/40"
                >
                  <X size={15} />
                  <span className="hidden sm:inline">{t("admin.activation.profile.close")}</span>
                  <span className="sr-only sm:hidden">{t("admin.activation.profile.close")}</span>
                </button>
                <StudentProfileView id={selected} />
              </div>
            ) : (
              <FileComing />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The list's narrowing to make room for a file, and its growing back (its `duration-[450ms]`). */
const LAYOUT_MS = 450;
/** The file sliding out, before the list grows back. */
const LEAVE_MS = 220;
/** Asked for less motion: everything at once. */
const still = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Where the file is coming: its shape, while the list makes room and the file is fetched. */
function FileComing() {
  return (
    <section className="forest-glow desk-file-in relative grid min-h-[26rem] place-items-center overflow-hidden rounded-3xl text-cream" aria-busy="true">
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -top-24 -end-16 size-96 rounded-full bg-gold/12 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-gold/50 to-transparent" />
      <span className="relative grid size-16 place-items-center rounded-3xl border border-gold/30 bg-gold/10 text-gold-soft">
        <Loader2 size={26} className="animate-spin" />
      </span>
    </section>
  );
}
