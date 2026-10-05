import { Images } from "lucide-react";
import { SlideBackdrop } from "../../../home/components/slide-backdrop";
import { useAdminAboutPage } from "../../hooks/site-content-hook";
import { defaultAboutPage, resolveAbout } from "../../../home/lib/site-content";
import { useLanguage } from "../../../../hooks/use-language";
import type { PublicHomeSlide, SiteLang } from "../../../../types/site.types";

/**
 * رأس «عن المنصة» مصغّراً — الخلفية نفسها، وفوقها العنوان المحفوظ في طرف
 * وموضع ساحة الصور في الآخر، فتُرى الصورة كما سيراها الزائر خلفهما.
 */
export function AboutBgPreview({ slides }: { slides: PublicHomeSlide[] }) {
  const { currentLang, dir } = useLanguage();
  const { data } = useAdminAboutPage();
  const block = resolveAbout(
    data ?? defaultAboutPage(),
    currentLang as SiteLang,
  );

  return (
    <div
      dir={dir}
      className="forest-glow relative aspect-[16/10] overflow-hidden"
    >
      <SlideBackdrop
        slides={slides}
        variant="wash"
        controls
        controlsClassName="bottom-2.5 end-2.5"
      />
      <div className="pointer-events-none relative grid h-full grid-cols-[1.1fr_1fr] items-center gap-4 px-5">
        <div className="min-w-0">
          <b
            dir="auto"
            className="block font-serif text-xl font-bold leading-tight text-cream"
          >
            {block.title}
          </b>
          <span className="mt-2 block h-0.5 w-10 rounded-full bg-gold" />
          {block.subtitle && (
            <p
              dir="auto"
              className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-cream/75"
            >
              {block.subtitle}
            </p>
          )}
        </div>
        {/* موضع ساحة الصور — تبقى أمام الخلفية */}
        <div className="grid aspect-[4/3] place-items-center rounded-xl border border-gold/40 bg-black/25 text-gold-soft/80">
          <Images size={22} />
        </div>
      </div>
    </div>
  );
}
