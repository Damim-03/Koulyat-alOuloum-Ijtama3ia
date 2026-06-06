import { GraduationCap, Users, ShieldCheck } from "lucide-react";

export function AuthHero() {
  return (
    <section className="max-md:order-2 p-2 [animation:fadeUp_0.6s_0.05s_both]">
      <div className="mb-12 flex items-center gap-3">
        <div className="grid size-[42px] place-items-center rounded-xl bg-gradient-to-br from-mint to-teal text-[#06302a] shadow-[0_8px_24px_rgba(45,212,191,0.25)]">
          <GraduationCap size={22} strokeWidth={2.2} />
        </div>
        <div>
          <div className="text-[15px] font-bold">جامعة الشهيد حمه لخضر — الوادي</div>
          <div className="mt-0.5 text-[12.5px] text-muted">نظام إدارة مشاريع التخرج</div>
        </div>
      </div>

      <h1 className="mb-5 font-display text-5xl font-extrabold leading-[1.18] tracking-[-0.5px] max-md:text-4xl">
        مرحباً بعودتك إلى
        <br />
        <span className="bg-gradient-to-l from-mint to-teal bg-clip-text text-transparent">رحلة التخرج</span>
      </h1>

      <p className="mb-7 max-w-[440px] text-base leading-[1.9] text-muted">
        نظام متكامل لإدارة ومتابعة مشاريع التخرج. للوصول إلى بياناتك والتواصل مع مشرفيك.
      </p>

      <div className="flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-[13px]">
          <Users size={15} className="text-teal" /> +2000 طالب
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3.5 py-2 text-[13px]">
          <ShieldCheck size={15} className="text-teal" /> نظام معتمد
        </span>
      </div>
    </section>
  );
}