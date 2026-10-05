import universityLogo from "../../../../assets/university-logo.png";
import { SlideBackdrop } from "../../../home/components/slide-backdrop";
import { useAdminLoginContent } from "../../hooks/site-content-hook";
import {
  defaultLoginContent,
  resolveLogin,
} from "../../../home/lib/site-content";
import { useLanguage } from "../../../../hooks/use-language";
import type {
  LoginBlock,
  PublicHomeSlide,
  SiteLang,
} from "../../../../types/site.types";

/**
 * لوحة الترحيب مصغّرةً — الخلفية نفسها التي في صفحة الدخول، وفوقها الشعار
 * والنصوص بترتيبها، فتُرى الصورة والكلمات كما سيراها الزائر.
 *
 * وما فرغ من النصوص الاختيارية لا يُرسم، كما في الصفحة.
 */
export function LoginPreview({
  slides,
  texts,
  dir,
}: {
  slides: PublicHomeSlide[];
  texts: LoginBlock;
  dir?: "rtl" | "ltr";
}) {
  return (
    <div
      dir={dir}
      className="forest-glow relative flex aspect-[4/5] flex-col overflow-hidden px-5 pb-4 pt-6 text-center"
    >
      <SlideBackdrop slides={slides} />
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />

      <div className="pointer-events-none relative flex flex-1 flex-col items-center justify-center">
        <span className="mb-3 grid size-16 place-items-center rounded-2xl bg-[#fbf6ea] p-1.5 shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] ring-1 ring-gold/70">
          <img
            src={universityLogo}
            alt=""
            className="size-full object-contain"
            draggable={false}
          />
        </span>
        <b
          dir="auto"
          className="text-[12.5px] font-bold leading-snug text-cream"
        >
          {texts.university}
        </b>
        <span className="mt-1 flex items-center gap-1.5 text-[10.5px] font-semibold text-gold-soft">
          <span className="size-1 rotate-45 bg-gold" />
          <span dir="auto">{texts.platform}</span>
          <span className="size-1 rotate-45 bg-gold" />
        </span>
        <b
          dir="auto"
          className="mt-4 font-display text-xl font-extrabold leading-snug text-cream"
        >
          {texts.welcome}
          {texts.highlight && (
            <>
              <br />
              <span className="text-gold-soft">{texts.highlight}</span>
            </>
          )}
        </b>
        {texts.body && (
          <p
            dir="auto"
            className="mt-2.5 line-clamp-4 text-[10.5px] leading-relaxed text-cream/70"
          >
            {texts.body}
          </p>
        )}
      </div>

      {texts.note && (
        <p
          dir="auto"
          className="relative mt-2 text-[9.5px] leading-snug text-cream/50"
        >
          {texts.note}
        </p>
      )}
    </div>
  );
}

/** المعاينة بالنصوص المحفوظة — في جزء «الخلفية»، بلغة لوحة الإدارة. */
export function SavedLoginPreview({ slides }: { slides: PublicHomeSlide[] }) {
  const { currentLang, dir } = useLanguage();
  const { data } = useAdminLoginContent();
  const texts = resolveLogin(
    data ?? defaultLoginContent(),
    currentLang as SiteLang,
  );
  return <LoginPreview slides={slides} texts={texts} dir={dir} />;
}
