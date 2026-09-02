import { useLanguage } from "../../../hooks/use-language";
import type { LangCode } from "../../i18n";
import { cn } from "../../../lib/utils";

interface Props {
  /** "header" = compact (AR/EN/FR), "menu" = full labels (mobile) */
  variant?: "header" | "menu";
  className?: string;
}

// Theme-neutral switcher — inherits text color from its parent bar,
// so it works on the dark forest navbar and the dark teal auth screens.
export function LanguageSwitcher({ variant = "header", className = "" }: Props) {
  const { currentLang, languages, switchLanguage } = useLanguage();
  const isMenu = variant === "menu";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {languages.map((lang) => {
        const active = currentLang === lang.code;
        return (
          <button
            key={lang.code}
            onClick={() => switchLanguage(lang.code as LangCode)}
            className={cn(
              "rounded-md font-bold transition-colors",
              isMenu ? "px-3 py-1.5 text-xs" : "px-2.5 py-1 text-[11px]",
              active
                ? "bg-cream-card/90 text-forest"
                : "text-current/60 hover:bg-current/10 hover:text-current",
            )}
          >
            {isMenu ? lang.label : lang.labelShort}
          </button>
        );
      })}
    </div>
  );
}