import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

/** أقصى ارتفاعٍ للّائحة — يُستعمل في حساب الجهة قبل الرسم. */
const MAX_LIST_H = 264;

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
 * وتُقلب إلى الأعلى حين لا يتّسع ما تحتها، وتتبع الزرّ عند التمرير والتحجيم.
 *
 * والبناء نمط «combobox ومعه listbox»: التركيز يبقى على الزرّ، والعنصر
 * النشط يُعلَن بـ`aria-activedescendant`. ولوحة المفاتيح كاملة: الأسهم
 * تتنقّل، و`Enter`/`Space` يفتحان ويختاران، و`Escape` يغلق، و`Home`/`End`
 * يقفزان إلى الطرفين.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  className = "",
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
   * مرجعٌ إلى زرّ الفتح.
   *
   * تحتاجه `react-hook-form`: `setFocus` تنقل التركيز إلى أوّل حقلٍ ناقص،
   * ولا تجد ما تُركّزه إن لم يُسلَّم لها مرجع. ومن دونه يصمت النداء بلا خطأ
   * — وتبقى الميزة تعمل في المُدخلات وتسقط في القوائم وحدها.
   */
  ref?: React.Ref<HTMLButtonElement>;
  "aria-label"?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    drop: "down" | "up";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  /** موضع اللائحة من إحداثيّات الزرّ الحالية — تُحسب عند الفتح وعند كل تمرير. */
  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < Math.min(MAX_LIST_H, options.length * 40 + 8) && r.top > below;
    setPos({
      top: up ? r.top : r.bottom,
      left: r.left,
      width: r.width,
      drop: up ? "up" : "down",
    });
  };

  // النقر خارج الزرّ واللائحة معاً يغلق — واللائحة خارج شجرة الصندوق الآن.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      )
        setOpen(false);
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

  function openList() {
    if (disabled) return;
    measure();
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function pick(i: number) {
    const option = options[i];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
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

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const list =
    open && pos ? (
      <ul
        ref={listRef}
        id={`${id}-list`}
        role="listbox"
        aria-label={ariaLabel}
        data-testid="select-list"
        style={{
          position: "fixed",
          top: pos.drop === "down" ? pos.top + 6 : undefined,
          bottom:
            pos.drop === "up" ? window.innerHeight - pos.top + 6 : undefined,
          left: pos.left,
          width: pos.width,
          maxHeight: MAX_LIST_H,
        }}
        className="z-100 overflow-y-auto rounded-xl border border-forest/15 bg-cream-card p-1 shadow-[0_12px_30px_rgba(38,66,61,0.18)]"
      >
        {options.map((o, i) => {
          const isSelected = o.value === value;
          return (
            <li key={o.value || `__${i}`}>
              <button
                type="button"
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm transition ${
                  isSelected
                    ? "bg-gold/15 font-semibold text-forest"
                    : i === active
                      ? "bg-forest/6 text-forest"
                      : "text-clay"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && <Check size={15} className="shrink-0 text-gold" />}
              </button>
            </li>
          );
        })}
      </ul>
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
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-cream-2 px-3 py-2.5 text-start text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
          open
            ? "border-gold ring-2 ring-gold/30"
            : "border-forest/15 hover:border-gold/50 focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
        } ${selected ? "text-forest" : "text-clay"}`}
      >
        <span className="truncate">{selected?.label ?? placeholder ?? ""}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-clay transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {list && createPortal(list, document.body)}
    </div>
  );
}
