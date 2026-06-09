import { Link, type LinkProps } from "react-router-dom";
import { useLanguage } from "../../../hooks/use-language";

interface LocaleLinkProps extends Omit<LinkProps, "to"> {
  to: string;
}

// Drop-in <Link> that auto-prepends the current language
// ("/login" -> "/ar/login"). External and #hash links pass through.
export function LocaleLink({ to, ...rest }: LocaleLinkProps) {
  const { localePath } = useLanguage();

  const isExternal = to.startsWith("http") || to.startsWith("//");
  const isHash = to.startsWith("#");
  const href = isExternal || isHash ? to : localePath(to);

  return <Link to={href} {...rest} />;
}