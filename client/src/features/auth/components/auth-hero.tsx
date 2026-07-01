import { GraduationCap } from "lucide-react";
import { LanguageSwitcher } from "../../../i18n/locales/components/language-switcher";

export function AuthHero() {
  return (
    <section className="forest-glow relative hidden overflow-hidden p-10 text-cream lg:flex lg:flex-col lg:justify-between">
      {/* atmosphere */}
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -right-28 top-6 size-96 rounded-full border border-gold/15" />
      <div className="pointer-events-none absolute -left-20 bottom-20 size-72 rounded-full border border-soft-sage/25 bg-soft-sage/[0.05]" />

      {/* top row: switcher (start) + brand (end) */}
      <div className="relative flex items-center justify-between">
        <LanguageSwitcher />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[14px] font-bold leading-tight text-cream">
              جامعة الشهيد حمه لخضر — الوادي
            </div>
            <div className="mt-0.5 text-[11.5px] text-cream/55">
              نظام إدارة مشاريع التخرج
            </div>
          </div>
          <div className="relative grid size-11 place-items-center">
            <div className="seal-ring pointer-events-none absolute -inset-2 rounded-full" />
            <div className="grid size-11 place-items-center rounded-xl bg-linear-to-br from-gold-soft to-gold text-forest-deep shadow-[0_10px_28px_rgba(193,150,90,0.30)]">
              <GraduationCap size={21} strokeWidth={2.2} />
            </div>
          </div>
        </div>
      </div>

      {/* center: headline */}
      <div className="relative">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-[11.5px] font-semibold tracking-wide text-gold-soft animate-[fadeUp_0.6s_both]">
          منصّة مذكّرتي
        </span>

        <h1 className="mb-5 font-display text-[3.2rem] font-extrabold leading-[1.3] tracking-[-0.5px] animate-[fadeUp_0.6s_0.05s_both]">
          مرحباً بعودتك إلى
          <br />
          <span className="bg-linear-to-l from-gold-soft to-gold bg-clip-text text-transparent">
            رحلة التخرّج
          </span>
        </h1>

        <p className="mb-7 max-w-110 text-[15px] leading-[1.95] text-cream/70 animate-[fadeUp_0.6s_0.1s_both]">
          نظام متكامل لإدارة ومتابعة مشاريع التخرّج. سجّل دخولك للوصول إلى
          بياناتك والتواصل مع مشرفيك في كل مرحلة.
        </p>
      </div>

      {/* bottom: support note */}
      <div className="relative text-[12px] text-cream/45 animate-[fadeUp_0.6s_0.2s_both]">
        تُمنح بيانات الدخول من إدارة الكلية. لأي مشكلة، تواصل مع الإدارة.
      </div>
    </section>
  );
}
