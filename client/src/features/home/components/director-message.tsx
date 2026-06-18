import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Quote, GraduationCap } from "lucide-react";
import { useLanguage } from "../../../hooks/use-language";

// "كلمة رئيس القسم" — replace PHOTO and the director.* strings later.
const PHOTO =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=600&auto=format&fit=crop";

export function DirectorMessage() {
  const { t } = useTranslation();
  const { dir, isRTL } = useLanguage();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ob = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          ob.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    if (ref.current) ob.observe(ref.current);
    return () => ob.disconnect();
  }, []);

  // Safe: if the key is missing, i18next returns a string — fall back to [].
  const raw = t("director.messages", { returnObjects: true });
  const paras = Array.isArray(raw) ? (raw as string[]) : [];

  return (
    <section
      ref={ref}
      dir={dir}
      className="relative overflow-hidden bg-cream-2 py-20 font-body lg:py-28"
    >
      {/* background atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[5%] top-[8%] size-80 rounded-full bg-forest/[0.04]" />
        <div className="absolute bottom-[10%] right-[3%] size-96 rounded-full bg-gold/[0.05]" />
        <div className="dot-matrix absolute inset-0 opacity-[0.4]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        {/* header */}
        <div
          className={`mb-14 text-center transition-all duration-1000 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <h2 className="font-serif text-3xl font-bold text-forest sm:text-4xl">
            {t("director.sectionTitle")}
          </h2>
          <div className="mt-3 flex justify-center">
            <div
              className={`h-1 rounded-full bg-gold transition-all duration-1000 ${
                visible ? "w-16" : "w-0"
              }`}
              style={{ transitionDelay: "300ms" }}
            />
          </div>
        </div>

        {/* content */}
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[400px_1fr] lg:gap-16">
          {/* photo */}
          <div
            className={`transition-all duration-1000 ${
              visible
                ? "translate-x-0 opacity-100"
                : `opacity-0 ${isRTL ? "translate-x-12" : "-translate-x-12"}`
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className="group relative">
              <div
                className={`absolute -top-4 -z-10 size-full rounded-2xl border-2 border-gold/25 transition group-hover:scale-[1.02] ${
                  isRTL ? "-right-4" : "-left-4"
                }`}
              />
              <div
                className={`absolute -bottom-4 -z-10 size-full rounded-2xl border-2 border-forest/15 transition group-hover:scale-[1.02] ${
                  isRTL ? "-left-4" : "-right-4"
                }`}
              />
              <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-forest/20">
                <img
                  src={PHOTO}
                  alt={t("director.fullName")}
                  className="aspect-4/5 w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-linear-to-t from-forest-deep/70 via-transparent to-transparent opacity-80" />
                <div className="absolute right-4 top-4 grid size-10 translate-y-2 place-items-center rounded-xl border border-white/20 bg-white/15 opacity-0 backdrop-blur-md transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <GraduationCap className="size-5 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* text */}
          <div
            className={`pt-6 transition-all duration-1000 lg:pt-0 ${
              visible
                ? "translate-x-0 opacity-100"
                : `opacity-0 ${isRTL ? "-translate-x-12" : "translate-x-12"}`
            }`}
            style={{ transitionDelay: "400ms" }}
          >
            <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-forest/[0.08]">
              <Quote className="size-7 text-forest" strokeWidth={1.5} />
            </div>

            <h3 className="mb-6 font-serif text-xl font-bold leading-snug text-forest lg:text-2xl">
              {t("director.title")}
            </h3>

            <div className="space-y-4">
              {paras.map((p, i) => (
                <p
                  key={i}
                  className={`text-[15px] leading-[1.9] text-clay transition-all duration-700 ${
                    visible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                  style={{ transitionDelay: `${600 + i * 150}ms` }}
                >
                  {p}
                </p>
              ))}
            </div>

            {/* highlight */}
            <div
              className={`mt-6 rounded-xl bg-cream-card p-4 transition-all duration-700 ${
                visible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              } ${isRTL ? "border-r-4" : "border-l-4"} border-gold`}
              style={{ transitionDelay: "1050ms" }}
            >
              <p className="text-sm font-semibold italic leading-relaxed text-forest">
                "{t("director.highlightQuote")}"
              </p>
            </div>

            {/* signature */}
            <div
              className={`mt-8 flex items-center gap-4 border-t border-forest/10 pt-6 transition-all duration-700 ${
                visible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-4 opacity-0"
              }`}
              style={{ transitionDelay: "1200ms" }}
            >
              <div className="relative">
                <div className="grid size-14 shrink-0 place-items-center rounded-full bg-forest/10">
                  <span className="text-xl font-bold text-forest">
                    {t("director.initials")}
                  </span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full border-2 border-cream-2 bg-gold" />
              </div>
              <div>
                <p className="font-serif font-bold text-forest">
                  {t("director.fullName")}
                </p>
                <p className="text-sm text-clay">{t("director.role")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
