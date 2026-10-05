import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../../hooks/use-language";
import { isInternalLink } from "../lib/site-content";

/**
 * خبرٌ برابطه إن كان له رابط: الداخليّ في الصفحة نفسها وبلغة الزائر،
 * والخارجيّ في تبويبٍ جديد. وبلا رابطٍ يبقى نصّاً.
 */
export function NewsLink({
  href,
  duplicate = false,
  className,
  children,
}: {
  href: string | null;
  /** نسخةٌ للدوران وحده: لا تُقرأ مرّتين ولا تُبلَغ بالتنقّل. */
  duplicate?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { localePath } = useLanguage();
  const common = {
    className,
    "aria-hidden": duplicate || undefined,
    tabIndex: duplicate ? -1 : undefined,
  };

  if (!href) return <span {...common}>{children}</span>;
  if (isInternalLink(href))
    return (
      <Link to={localePath(href)} {...common}>
        {children}
      </Link>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...common}>
      {children}
    </a>
  );
}
