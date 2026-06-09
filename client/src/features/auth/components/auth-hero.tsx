import { GraduationCap, Users, ShieldCheck, BookOpen, Quote } from "lucide-react";
import { LanguageSwitcher } from "../../../i18n/locales/components/language-switcher";

export function AuthHero() {
  return (
    <section className="relative hidden overflow-hidden border-l border-white/[0.06] p-10 text-fg lg:flex lg:flex-col lg:justify-between">
      {/* atmosphere */}
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -right-24 top-10 size-96 rounded-full border border-mint/10 bg-mint/[0.03] blur-[1px]" />
      <div className="pointer-events-none absolute -left-16 bottom-24 size-72 rounded-full border border-teal/10 bg-teal/[0.04]" />

      {/* top row: switcher (start) + brand (end) */}
      <div className="relative flex items-center justify-between">
        <LanguageSwitcher />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[14px] font-bold leading-tight">
              جامعة الشهيد حمه لخضر — الوادي
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted">
              نظام إدارة مشاريع التخرج
            </div>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-mint to-teal text-[#06302a] shadow-[0_8px_24px_rgba(45,212,191,0.25)]">
            <GraduationCap size={20} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      {/* center: headline */}
      <div className="relative">
        <h1 className="mb-5 font-display text-5xl font-extrabold leading-[1.18] tracking-[-0.5px] [animation:fadeUp_0.6s_0.05s_both]">
          مرحباً بعودتك إلى
          <br />
          <span className="bg-gradient-to-l from-mint to-teal bg-clip-text text-transparent">
            رحلة التخرج
          </span>
        </h1>

        <p className="mb-7 max-w-[440px] text-base leading-[1.9] text-muted [animation:fadeUp_0.6s_0.1s_both]">
          نظام متكامل لإدارة ومتابعة مشاريع التخرج. للوصول إلى بياناتك والتواصل
          مع مشرفيك.
        </p>

        <div className="flex flex-wrap gap-3 [animation:fadeUp_0.6s_0.15s_both]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-[13px]">
            <ShieldCheck size={15} className="text-teal" /> نظام معتمد
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-[13px]">
            <Users size={15} className="text-teal" /> +2000 طالب
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-[13px]">
            <BookOpen size={15} className="text-teal" /> +150 مشرف
          </span>
        </div>
      </div>

      {/* bottom: testimonial */}
      <div className="relative max-w-[440px] rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 [animation:fadeUp_0.6s_0.2s_both]">
        <Quote size={18} className="mb-2 text-teal/70" />
        <p className="mb-3 text-[13.5px] leading-[1.8] text-fg/80">
          المنصة سهّلت عليّ متابعة مشروعي والتواصل مع مشرفي في كل مرحلة.
        </p>
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-mint to-teal text-[11px] font-bold text-[#06302a]">
            ط
          </div>
          <div>
            <div className="text-[12.5px] font-bold">طالب سنة ثانية ماستر</div>
            <div className="text-[11px] text-muted">تخصص إعلام آلي</div>
          </div>
        </div>
      </div>
    </section>
  );
}