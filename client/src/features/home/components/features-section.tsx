import { useTranslation } from "react-i18next";
import { ListChecks, UsersRound, Milestone } from "lucide-react";
import { Reveal } from "./reveal";

const ICONS = [ListChecks, UsersRound, Milestone];
const ACCENTS = [
  { bg: "bg-forest/10", fg: "text-forest", blob: "bg-forest/5" },
  { bg: "bg-gold/15", fg: "text-gold", blob: "bg-gold/5" },
  { bg: "bg-sage/15", fg: "text-sage", blob: "bg-sage/5" },
];

interface Item {
  title: string;
  desc: string;
}

export function FeaturesSection() {
  const { t } = useTranslation();
  const items = t("features.items", { returnObjects: true }) as Item[];

  return (
    <section id="features" className="bg-cream px-5 py-20 font-body lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mb-12 text-center">
          <h2 className="mb-3 font-serif text-3xl font-bold text-forest md:text-4xl">
            {t("features.title")}
          </h2>
          <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-clay">
            {t("features.desc")}
          </p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {items.map((item, i) => {
            const Icon = ICONS[i % ICONS.length];
            const a = ACCENTS[i % ACCENTS.length];
            return (
              <Reveal key={item.title} delay={i * 120} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-2xl border border-forest/10 bg-cream-card p-7 transition hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(38,66,61,0.12)]">
                  <div
                    className={`absolute -left-10 -top-10 size-32 rounded-full ${a.blob} transition-transform duration-500 group-hover:scale-125`}
                  />
                  <div
                    className={`relative mb-5 grid size-12 place-items-center rounded-xl ${a.bg} ${a.fg}`}
                  >
                    <Icon size={24} />
                  </div>
                  <h3 className="relative mb-2 font-serif text-xl font-semibold text-forest">
                    {item.title}
                  </h3>
                  <p className="relative text-[14px] leading-[1.8] text-clay">
                    {item.desc}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
