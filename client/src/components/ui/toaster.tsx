import { Toaster as Sonner } from "sonner";
import { AlertTriangle, Check, Info, Loader2, X } from "lucide-react";
import { useLanguage } from "../../hooks/use-language";

/** شعار الإشعار: أيقونة النوع في مربّعٍ بلونه، كشعار نوافذ التنبيه. */
const emblem = (gradient: string, icon: React.ReactNode) => (
  <span
    className={`grid size-9 place-items-center rounded-xl bg-linear-to-br ring-1 ring-white/20 shadow-[0_8px_18px_-8px_rgba(0,0,0,0.45)] ${gradient}`}
  >
    {icon}
  </span>
);

/**
 * الإشعارات العابرة — «حُفظ»، «حُذف»، «تعذّر…» — بشكل التنبيهات في المنصّة:
 * بطاقةٌ بلون السطح (تتبع الوضع الفاتح والداكن)، وشعارٌ بلون النوع، وخيطٌ
 * بلونه على حافّتها، وعنوانٌ بخطّ العناوين.
 */
export function Toaster() {
  // Toasts render in a portal, so they need the direction passed in.
  const { dir } = useLanguage();
  return (
    <Sonner
      position="top-center"
      dir={dir}
      closeButton
      gap={10}
      icons={{
        success: emblem("from-[#6fa394] to-[#3d6b5f] text-white", <Check size={17} strokeWidth={2.6} />),
        error: emblem("from-[#d66a4f] to-[#8c301d] text-white", <X size={17} strokeWidth={2.6} />),
        warning: emblem("from-gold-soft to-gold text-[var(--t-brand-deep)]", <AlertTriangle size={17} strokeWidth={2.4} />),
        info: emblem("from-[#3a6258] to-[#1a312d] text-[#f5edda]", <Info size={17} strokeWidth={2.4} />),
        loading: emblem("from-cream-2 to-cream-2 text-gold", <Loader2 size={17} className="animate-spin" />),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-gold/20 bg-cream-card py-3.5 ps-4 pe-10 font-body shadow-[0_22px_50px_-18px_rgba(4,10,8,0.55)] ring-1 ring-black/5 before:absolute before:inset-y-0 before:start-0 before:w-1",
          success: "before:bg-linear-to-b before:from-[#6fa394] before:to-[#3d6b5f]",
          error: "before:bg-linear-to-b before:from-[#d66a4f] before:to-[#8c301d]",
          warning: "before:bg-linear-to-b before:from-gold-soft before:to-gold",
          info: "before:bg-linear-to-b before:from-sage before:to-[#1a312d]",
          loading: "before:bg-gold/50",
          icon: "shrink-0",
          content: "min-w-0 flex-1",
          title: "font-serif text-[14.5px] leading-snug font-bold text-forest",
          description: "mt-0.5 text-[12.5px] leading-relaxed text-clay",
          closeButton:
            "absolute end-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-clay ring-1 ring-forest/10 transition hover:bg-forest/5 hover:text-forest",
          actionButton:
            "shrink-0 rounded-xl bg-linear-to-b from-gold-soft to-gold px-3 py-1.5 text-xs font-bold text-[var(--t-brand-deep)]",
          cancelButton: "shrink-0 rounded-xl border border-forest/15 px-3 py-1.5 text-xs font-bold text-forest",
        },
      }}
    />
  );
}
