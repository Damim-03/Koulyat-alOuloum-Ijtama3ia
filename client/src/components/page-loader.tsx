import { useTranslation } from "react-i18next";

import { FacultySpinner } from "./ui/faculty-spinner";

/**
 * شاشةُ التحميل الكاملة.
 *
 * كانت أيقونةَ قبّعةِ تخرّجٍ عامّة — تصلح لأيّ منصّةٍ جامعية في العالم. صارت
 * شعارَ الكلّية: أوّلُ ما يُرى من النظام يقول أيُّ نظامٍ هو.
 */
export function PageLoader() {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-cream"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-7">
        <FacultySpinner size={128} />

        <div className="h-1 w-40 overflow-hidden rounded-full bg-forest/10">
          <div className="h-full w-1/2 animate-[loaderSweep_1.2s_ease-in-out_infinite] rounded-full bg-linear-to-r from-gold to-forest" />
        </div>

        <p className="text-[12px] tracking-wide text-clay">
          {t("loader.tagline")}
        </p>
      </div>

      <style>{`
        @keyframes loaderSweep {
          0% { margin-left: -50%; }
          100% { margin-left: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[loaderSweep_1\\.2s_ease-in-out_infinite\\] {
            animation: none;
            margin-left: 25%;
          }
        }
      `}</style>
    </div>
  );
}
