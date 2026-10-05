import {
  CalendarCheck,
  GraduationCap,
  Images,
  ListChecks,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { AboutStat, PublicHomeSlide } from "../../../../types/site.types";
import { PlatformGallery } from "./platform-gallery";

/**
 * الجانب المرئيّ من رأس «عن المنصة» — ساحة صور المنصة.
 *
 * الصور تتعاقب في إطارٍ ذهبيّ، فوقه عنوانُ المعرض، وعلى زاويته بطاقةٌ زجاجيةٌ
 * عليها أوّل الأرقام. وبلا صورةٍ واحدة: شعارٌ — قبّعة التخرّج في حلقاتٍ ذهبيّة
 * تدور ببطء، وحولها أيقونات ما تفعله المنصة — كي لا يبقى نصف الرأس فارغاً.
 */
export function AboutHeroVisual({
  slides,
  stat,
  title,
}: {
  slides: PublicHomeSlide[];
  stat?: AboutStat;
  /** عنوان المعرض كما كتبته الإدارة — يُعرض فوق الإطار إن وُجد. */
  title?: string;
}) {
  return slides.length ? <Showcase slides={slides} stat={stat} title={title} /> : <Emblem />;
}

function Showcase({
  slides,
  stat,
  title,
}: {
  slides: PublicHomeSlide[];
  stat?: AboutStat;
  title?: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-xl animate-[riseIn_0.8s_0.15s_both] lg:max-w-none">
      {title && (
        <p className="mb-4 flex items-center justify-center gap-2 text-[12px] font-bold uppercase tracking-[0.2em] text-gold-soft lg:justify-start">
          <Images size={15} />
          <span dir="auto">{title}</span>
        </p>
      )}

      <div className="relative">
        {/* إطارٌ ذهبيّ خلف الساحة، مزاحٌ عنها */}
        <div className="pointer-events-none absolute -bottom-4 -end-4 start-5 top-5 rounded-[2rem] border border-gold/35" />

        <div className="relative rounded-[2rem] bg-linear-to-br from-gold/70 via-gold/10 to-gold/60 p-px shadow-[0_40px_100px_-30px_rgba(0,0,0,0.65)]">
          <div className="rounded-[calc(2rem-1px)] bg-[var(--t-brand-deep)] p-2">
            <PlatformGallery slides={slides} variant="hero" />
          </div>
        </div>

        {stat && (
          <div className="absolute -bottom-6 -start-3 z-20 rounded-2xl border border-white/15 bg-black/45 px-5 py-3.5 shadow-xl backdrop-blur-md motion-safe:animate-[floatY_4s_ease-in-out_infinite] sm:-start-6">
            <b dir="ltr" className="block font-serif text-3xl leading-none text-gold-soft">
              {stat.value}
            </b>
            <span dir="auto" className="mt-1 block text-[12px] font-medium text-white/85">
              {stat.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const ORBIT: { icon: LucideIcon; pos: string; delay: string }[] = [
  { icon: ListChecks, pos: "top-[6%] left-1/2 -translate-x-1/2", delay: "0s" },
  { icon: UsersRound, pos: "top-1/2 end-[2%] -translate-y-1/2", delay: "0.8s" },
  { icon: CalendarCheck, pos: "bottom-[6%] left-1/2 -translate-x-1/2", delay: "1.6s" },
  { icon: ShieldCheck, pos: "top-1/2 start-[2%] -translate-y-1/2", delay: "2.4s" },
];

function Emblem() {
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[420px] animate-[riseIn_0.8s_0.15s_both]">
      <div className="absolute inset-0 rounded-full border border-gold/15" />
      <div className="absolute inset-[9%] rounded-full border border-dashed border-gold/35 motion-safe:animate-[spin_60s_linear_infinite]" />
      <div className="absolute inset-[22%] rounded-full border border-gold/25 bg-linear-to-br from-white/[0.06] to-transparent shadow-[0_0_80px_-10px_rgba(193,150,90,0.35)] backdrop-blur-sm" />
      <div className="absolute inset-[32%] grid place-items-center rounded-full bg-linear-to-br from-gold to-gold-soft shadow-[0_20px_60px_-15px_rgba(193,150,90,0.6)]">
        <GraduationCap className="size-1/2 text-[#1a312d]" strokeWidth={1.4} />
      </div>

      {ORBIT.map(({ icon: Icon, pos, delay }) => (
        <span key={pos} className={`absolute ${pos}`}>
          <span
            className="grid size-14 place-items-center rounded-2xl border border-white/15 bg-black/30 text-gold-soft shadow-lg backdrop-blur-md motion-safe:animate-[floatY_4s_ease-in-out_infinite]"
            style={{ animationDelay: delay }}
          >
            <Icon size={24} />
          </span>
        </span>
      ))}
    </div>
  );
}
