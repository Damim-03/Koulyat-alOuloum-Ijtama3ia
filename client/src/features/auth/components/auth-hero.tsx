import { LanguageSwitcher } from "../../../i18n/locales/components/language-switcher";
import { useTranslation } from "react-i18next";
import universityLogo from "../../../assets/university-logo.png";
import { useHomeSlides } from "../../home/hooks/site-hook";
import { useLoginTexts } from "../hooks/use-login-texts";
import { SlideBackdrop } from "../../home/components/slide-backdrop";

/**
 * لوحة الترحيب في صفحة الدخول (الشاشات الواسعة).
 *
 * ونصوصها وخلفيتها تختارهما الإدارة من «واجهة الموقع ← صفحة الدخول»: الخلفية
 * صورةٌ معتَّمة بالأخضر — أو الأخضر وحده ما لم تختر شيئاً — والنصوص بلغة
 * الزائر، وما لم يُترجَم منها فبالعربية.
 *
 * شعار الجامعة في قلبها، بارزاً: على بطاقةٍ فاتحة — أخضره الداكن يغيب على
 * خلفية اللوحة الخضراء — في إطارٍ ذهبيّ، تحيط بها هالةٌ خافتة، ويعبرها
 * بريقٌ مرّةً عند الفتح. وتحته اسم الجامعة واسم المنصّة، ثمّ الترحيب.
 */
export function AuthHero() {
  const { t } = useTranslation();
  const { data: slides = [] } = useHomeSlides("login");
  const { texts, ready } = useLoginTexts();
  const hide = ready ? "" : "invisible";
  const k = ready ? "ready" : "wait";
  return (
    <section className="forest-glow relative hidden overflow-hidden p-10 text-cream lg:flex lg:flex-col lg:justify-between">
      {/* الخلفية: صور الإدارة إن وُجدت، وإلّا الأخضر وحده */}
      <SlideBackdrop slides={slides} />

      {/* atmosphere */}
      <div className="dot-matrix pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -right-28 top-6 size-96 rounded-full border border-gold/15" />
      <div className="pointer-events-none absolute -left-20 bottom-20 size-72 rounded-full border border-soft-sage/25 bg-soft-sage/[0.05]" />

      {/* top row: language */}
      <div className="relative flex items-center">
        <LanguageSwitcher />
      </div>

      {/* center: the university's seal, then the welcome */}
      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-7 size-40 animate-[fadeUp_0.6s_both] xl:size-48">
          {/* هالةٌ ذهبيّة، وإطارٌ رفيع حول البطاقة */}
          <div className="pointer-events-none absolute -inset-12 rounded-full bg-gold/20 blur-3xl" />
          <div className="pointer-events-none absolute -inset-3 rounded-[2.6rem] border border-gold/45" />

          <div className="logo-shine relative grid size-full place-items-center overflow-hidden rounded-[2.25rem] bg-[#fbf6ea] p-3 shadow-[0_28px_70px_-18px_rgba(0,0,0,0.55)] ring-1 ring-gold/70">
            <img
              src={universityLogo}
              alt={t("hero.subtitle")}
              className="size-full object-contain"
              draggable={false}
            />
          </div>
        </div>

        {/* النصوص تنتظر جواب الإدارة (`ready`)، ثمّ تنساب — والمفتاح يعيد
            حركتها حين تظهر بدل أن تكون انتهت وهي مخفيّة. */}
        <div
          key={k}
          className={`mb-8 animate-[fadeUp_0.6s_0.05s_both] ${hide}`}
        >
          <div
            dir="auto"
            className="font-display text-[17px] font-bold leading-tight text-cream"
          >
            {texts.university}
          </div>
          <div className="mt-2.5 flex items-center justify-center gap-2.5 text-[13px] font-semibold tracking-wide text-gold-soft">
            <span className="h-px w-8 bg-linear-to-l from-gold to-transparent" />
            <span className="size-1.5 rotate-45 bg-gold" />
            <span dir="auto">{texts.platform}</span>
            <span className="size-1.5 rotate-45 bg-gold" />
            <span className="h-px w-8 bg-linear-to-r from-gold to-transparent" />
          </div>
        </div>

        <h1
          key={`${k}-h`}
          dir="auto"
          className={`mb-5 font-display text-[2.8rem] font-extrabold leading-[1.3] tracking-[-0.5px] animate-[fadeUp_0.6s_0.1s_both] xl:text-[3.2rem] ${hide}`}
        >
          {texts.welcome}
          {texts.highlight && (
            <>
              <br />
              <span className="bg-linear-to-l from-gold-soft to-gold bg-clip-text text-transparent">
                {texts.highlight}
              </span>
            </>
          )}
        </h1>

        {texts.body && (
          <p
            key={`${k}-p`}
            dir="auto"
            className={`max-w-110 text-[15px] leading-[1.95] text-cream/70 animate-[fadeUp_0.6s_0.15s_both] ${hide}`}
          >
            {texts.body}
          </p>
        )}
      </div>

      {/* bottom: support note — والعنصر باقٍ ولو فرغ، فيبقى الترتيب كما هو */}
      <div
        key={`${k}-n`}
        dir="auto"
        className={`relative min-h-4 text-center text-[12px] text-cream/45 animate-[fadeUp_0.6s_0.2s_both] ${hide}`}
      >
        {texts.note}
      </div>
    </section>
  );
}
