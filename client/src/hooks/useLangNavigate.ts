import { useNavigate, useParams, type NavigateOptions } from "react-router-dom";

/**
 * مثل useNavigate لكنه يضيف بادئة اللغة الحالية (/:lang) تلقائياً
 * لأي مسار مطلق يبدأ بـ "/". المسارات النسبية تُترك كما هي.
 *
 * الاستخدام:
 *   const navigate = useLangNavigate();
 *   navigate("/admin/faculties/123"); // → /ar/admin/faculties/123
 */
export function useLangNavigate() {
  const navigate = useNavigate();
  const { lang } = useParams();

  return (to: string, options?: NavigateOptions) => {
    const target = to.startsWith("/") ? `/${lang}${to}` : to;
    navigate(target, options);
  };
}
