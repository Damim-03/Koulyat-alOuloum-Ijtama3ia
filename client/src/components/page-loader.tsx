import { useTranslation } from "react-i18next";
import { GraduationCap } from "lucide-react";

export function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-cream">
      <div className="flex flex-col items-center gap-6">
        <div className="relative grid size-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-forest/15" />
          <span className="grid size-16 place-items-center rounded-2xl bg-linear-to-br from-forest to-forest-deep text-cream shadow-lg">
            <GraduationCap size={30} />
          </span>
        </div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-forest/10">
          <div className="h-full w-1/2 animate-[loaderSweep_1.2s_ease-in-out_infinite] rounded-full bg-linear-to-r from-gold to-forest" />
        </div>
        <p className="text-[12px] tracking-wide text-clay">{t("loader.tagline")}</p>
      </div>
      <style>{`
        @keyframes loaderSweep {
          0% { margin-left: -50%; }
          100% { margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}