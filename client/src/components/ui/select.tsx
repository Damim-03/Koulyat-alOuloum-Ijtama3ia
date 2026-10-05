import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search, type LucideIcon } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  /** سطرٌ ثانٍ تحت العنوان — مكانُ الخيار، مثلاً «القسم · الكلّية». */
  hint?: string;
  /** عددٌ في طرف السطر — كم عنصراً يُظهر هذا الخيار. */
  count?: number;
}

/** أقصى ارتفاعٍ للّائحة — يُستعمل في حساب الجهة قبل الرسم. */
const MAX_LIST_H = 320;
/** أقصى عرضٍ للّائحة حين تتّسع لخياراتها فوق عرض الزرّ. */
const MAX_LIST_W = 420;
/** من هذا العدد فما فوق تظهر خانة بحثٍ أعلى اللائحة. */
const SEARCH_FROM = 9;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟ̀-ͯ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");

/**
 * قائمة اختيارٍ تتبع السمة.
 *
 * `<select>` الأصليّ يُنسَّق مغلقاً لا مفتوحاً: قائمته يرسمها النظام، فتظهر
 * بيضاء بسطرٍ أزرق فوق واجهةٍ داكنة — ولا حيلة لـCSS فيه. فبُني هنا زرٌّ
 * ولائحة، وكلاهما من رموز المشروع اللونية.
 *
 * **واللائحة تُرسَم في `body` لا داخل الصندوق.** أوّل بناءٍ وضعها
 * `absolute` داخل الحقل، فقصّها أوّلُ أبٍ له `overflow-hidden` — ولوحة
 * الفلاتر في صفحة المواضيع كذلك (تُطوى بارتفاعٍ متحرّك). والبديل الوحيد
 * الذي لا يمسّ تخطيط الصفحة: بوّابةٌ إلى `body` بموضعٍ ثابت محسوبٍ من
 * إحداثيّات الزرّ — فلا يقصّها شيء، ولا يتغيّر عرضُ حقلٍ ولا موضعه.
 *
 * **ولا تُقصّ الخيارات.** كانت اللائحة بعرض الزرّ تماماً وكلّ خيارٍ في سطرٍ
 * واحد، فيُبتر اسمٌ طويل («كلية العلوم الاجتماعية والإ…») في المكان الذي
 * يُختار فيه. فهي الآن تتّسع لخياراتها حتى حدٍّ معلوم — مثبّتةً على طرف
 * الزرّ الذي يبدأ منه النصّ — ويلتفّ ما زاد. ولكلّ خيارٍ سطرٌ ثانٍ وعدّادٌ
 * اختياريّان، وخانةُ بحثٍ للّوائح الطويلة.
 *
 * وتُقلب إلى الأعلى حين لا يتّسع ما تحتها، وتتبع الزرّ عند التمرير والتحجيم.
 *
 * والبناء نمط «combobox ومعه listbox»: النشط يُعلَن بـ`aria-activedescendant`
 * على ما يحمل التركيز — الزرّ، أو خانة البحث إن ظهرت. ولوحة المفاتيح كاملة:
 * الأسهم تتنقّل، و`Enter`/`Space` يفتحان ويختاران، و`Escape` يغلق،
 * و`Home`/`End` يقفزان إلى الطرفين.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  className = "",
  icon: Icon,
  filter,
  ref,
  "aria-label": ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** يظهر حين لا تُطابق القيمةُ خياراً — نادرٌ، لكنه خيرٌ من فراغ. */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /**
   * أيقونةٌ في صدر الزرّ.
   *
   * كانت الصفحات تضعها بنفسها `absolute` فوق القائمة، وتترك لها حشوةً في
   * `<select>` الأصليّ. ولمّا حلّ هذا المكوّن محلّه ذهبت الحشوة وبقيت
   * الأيقونة، فصارت تركب النصّ. فمكانها هنا، في صفّ المحتوى.
   */
  icon?: LucideIcon;
  /**
   * القائمة فلترٌ قيمتُه الفارغة «الكلّ»: حين تحمل قيمةً يتلوّن الزرّ، فيُرى
   * من بعيدٍ أيّ الفلاتر مطبَّق.
   */
  filter?: boolean;
  /**
   * مرجعٌ إلى زرّ الفتح.
   *
   * تحتاجه `react-hook-form`: `setFocus` تنقل التركيز إلى أوّل حقلٍ ناقص،
   * ولا تجد ما تُركّزه إن لم يُسلَّم لها مرجع. ومن دونه يصمت النداء بلا خطأ
   * — وتبقى الميزة تعمل في المُدخلات وتسقط في القوائم وحدها.
   */
  ref?: React.Ref<HTMLButtonElement>;
  "aria-label"?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{
    top: number;
    start: number;
    width: number;
    maxWidth: number;
    rtl: boolean;
    drop: "down" | "up";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const searchable = options.length >= SEARCH_FROM;

  // The indices still shown under the search — the options keep their own.
  const shown = useMemo(() => {
    const q = norm(query.trim());
    return options
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => !q || norm(`${o.label} ${o.hint ?? ""}`).includes(q));
  }, [options, query]);

  /** موضع اللائحة من إحداثيّات الزرّ الحالية — تُحسب عند الفتح وعند كل تمرير. */
  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    const below = window.innerHeight - r.bottom;
    const up = below < Math.min(MAX_LIST_H, options.length * 44 + 56) && r.top > below;
    // Anchored on the side the text starts from, it grows away from it.
    // `clientWidth`, not `innerWidth`: a fixed box's `right` is measured
    // from the viewport without its scrollbar.
    const vw = document.documentElement.clientWidth;
    const room = rtl ? r.right - 12 : vw - r.left - 12;
    setPos({
      top: up ? r.top : r.bottom,
      start: rtl ? vw - r.right : r.left,
      width: r.width,
      maxWidth: Math.max(r.width, Math.min(MAX_LIST_W, room)),
      rtl,
      drop: up ? "up" : "down",
    });
  };

  // النقر خارج الزرّ واللائحة معاً يغلق — واللائحة خارج شجرة الصندوق الآن.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!triggerRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false);
    };
    const follow = () => measure();
    document.addEventListener("pointerdown", onDown);
    // `capture` ليصل الحدث من أيّ حاويةٍ مُمرَّرة داخلياً لا من النافذة فقط.
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // العنصر النشط يبقى مرئياً وإن طالت اللائحة.
  useEffect(() => {
    if (!open) return;
    // `scrollIntoView` غير موجودةٍ في jsdom — ونداءٌ غير محروسٍ يُسقط كل
    // اختبارٍ يفتح لائحة. والحارس يكفي: التمرير تحسينٌ لا شرط.
    const el = listRef.current?.querySelector(`[data-index="${active}"]`);
    el?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  // A long list opens with its search box ready for typing.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  function openList() {
    if (disabled) return;
    measure();
    setQuery("");
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function close(refocus = false) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(i: number) {
    const option = options[i];
    if (!option) return;
    onChange(option.value);
    close(searchable);
  }

  /** Moves among the options still shown, from the active one. */
  function step(delta: number | "first" | "last") {
    if (shown.length === 0) return;
    const at = shown.findIndex((s) => s.i === active);
    const next =
      delta === "first" ? 0 : delta === "last" ? shown.length - 1 : Math.min(Math.max((at < 0 ? -1 : at) + delta, 0), shown.length - 1);
    setActive(shown[next].i);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    // In the search box a space is text, not a choice.
    const typing = e.target === searchRef.current;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        step(-1);
        break;
      case "Home":
        if (typing) break;
        e.preventDefault();
        step("first");
        break;
      case "End":
        if (typing) break;
        e.preventDefault();
        step("last");
        break;
      case " ":
        if (typing) break;
        e.preventDefault();
        pick(active);
        break;
      case "Enter":
        e.preventDefault();
        if (shown.some((s) => s.i === active)) pick(active);
        else if (shown[0]) pick(shown[0].i);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        close();
        break;
    }
  }

  const set = filter && !!value && !!selected;

  const pop =
    open && pos ? (
      <div
        ref={popRef}
        style={{
          position: "fixed",
          top: pos.drop === "down" ? pos.top + 6 : undefined,
          bottom: pos.drop === "up" ? window.innerHeight - pos.top + 6 : undefined,
          [pos.rtl ? "right" : "left"]: pos.start,
          minWidth: pos.width,
          maxWidth: pos.maxWidth,
          width: "max-content",
        }}
        className="z-100 animate-scale-in overflow-hidden rounded-2xl border border-forest/15 bg-cream-card shadow-[0_18px_40px_-12px_rgba(22,36,31,0.35)]"
      >
        {searchable && (
          <div className="border-b border-forest/10 p-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-clay" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  const q = norm(e.target.value.trim());
                  const first = options.findIndex((o) => !q || norm(`${o.label} ${o.hint ?? ""}`).includes(q));
                  if (first >= 0) setActive(first);
                }}
                onKeyDown={onKeyDown}
                role="searchbox"
                aria-controls={`${id}-list`}
                aria-activedescendant={`${id}-opt-${active}`}
                placeholder={t("common.selectSearch")}
                className="h-9 w-full rounded-lg border border-forest/12 bg-cream-2 ps-8 pe-2 text-[13px] text-forest outline-none focus:border-gold focus:ring-2 focus:ring-gold/25"
              />
            </div>
          </div>
        )}
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={ariaLabel}
          data-testid="select-list"
          style={{ maxHeight: MAX_LIST_H - (searchable ? 54 : 0) }}
          className="overflow-y-auto p-1.5"
        >
          {shown.length === 0 && <li className="px-3 py-4 text-center text-[12.5px] text-clay">{t("common.noOptions")}</li>}
          {shown.map(({ o, i }) => {
            const isSelected = o.value === value;
            const isActive = i === active;
            return (
              <li key={o.value || `__${i}`}>
                <button
                  type="button"
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  title={o.hint ? `${o.label} — ${o.hint}` : o.label}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(i)}
                  className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-start text-[13.5px] transition ${
                    isSelected
                      ? "bg-gold/15 font-semibold text-forest shadow-[inset_0_0_0_1px_rgba(193,150,90,0.35)]"
                      : isActive
                        ? "bg-forest/8 text-forest"
                        : "text-forest/80"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug break-words">{o.label}</span>
                    {o.hint && <span className="mt-0.5 block text-[11px] leading-snug font-normal break-words text-clay">{o.hint}</span>}
                  </span>
                  {o.count !== undefined && (
                    <span
                      className={`mt-px shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ${
                        isSelected ? "bg-gold/25 text-forest" : "bg-forest/8 text-forest/75"
                      }`}
                    >
                      {o.count}
                    </span>
                  )}
                  <Check size={15} className={`mt-0.5 shrink-0 text-gold ${isSelected ? "" : "invisible"}`} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  return (
    <div className={className}>
      <button
        ref={(node) => {
          triggerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.RefObject<HTMLButtonElement | null>).current = node;
        }}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && !searchable ? `${id}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        // القيمة تُقصّ حين يضيق الحقل، فيبقى العنوان الكامل في التلميح.
        title={selected?.label ?? placeholder}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-start text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
          open
            ? "border-gold bg-cream-2 ring-2 ring-gold/30"
            : set
              ? "border-gold/60 bg-gold/10 font-semibold hover:border-gold"
              : "border-forest/15 bg-cream-2 hover:border-gold/50 focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
        } ${selected ? "text-forest" : "text-clay"}`}
      >
        {Icon && <Icon size={15} className={`shrink-0 ${set ? "text-gold" : "text-clay"}`} />}
        <span className="min-w-0 flex-1 truncate text-start">{selected?.label ?? placeholder ?? ""}</span>
        <ChevronDown size={16} className={`shrink-0 text-clay transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {pop && createPortal(pop, document.body)}
    </div>
  );
}
