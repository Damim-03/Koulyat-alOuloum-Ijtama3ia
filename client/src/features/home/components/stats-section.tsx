import { useTranslation } from "react-i18next";

interface Stat {
  value: string;
  label: string;
  sub: string;
}

export function StatsSection() {
  const { t } = useTranslation();
  const items = t("stats.items", { returnObjects: true }) as Stat[];

  return (
    <section id="stats" className="relative overflow-hidden bg-forest px-5 py-16 font-body text-cream lg:px-8">
      <div className="dot-matrix absolute inset-0 opacity-20" />
      <div className="relative mx-auto grid max-w-5xl gap-10 text-center md:grid-cols-3 md:divide-x md:divide-x-reverse md:divide-cream/10">
        {items.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1.5 px-4">
            <span className="font-serif text-4xl font-bold text-gold md:text-5xl">{s.value}</span>
            <span className="font-serif text-lg text-cream">{s.label}</span>
            <p className="text-[12.5px] text-soft-sage/80">{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}