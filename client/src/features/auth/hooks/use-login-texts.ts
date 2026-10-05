import { useLanguage } from "../../../hooks/use-language";
import { useLoginContent } from "../../home/hooks/site-hook";
import { defaultLoginContent, resolveLogin } from "../../home/lib/site-content";
import type { SiteLang } from "../../../types/site.types";

/**
 * نصوص لوحة الترحيب بلغة الزائر — كما كتبتها الإدارة في «واجهة الموقع»، أو
 * نصّها الافتراضيّ ما لم تحفظ شيئاً (أو تعذّر جلبها).
 *
 * و`ready` يقول إنّ الجواب وصل: النصوص تُخفى حتى يصل، فلا يرى الزائر النصّ
 * الافتراضيّ ثمّ يتبدّل أمامه بما كتبته الإدارة.
 */
export function useLoginTexts() {
  const { currentLang } = useLanguage();
  const { data, isPending, isError } = useLoginContent();
  const texts = resolveLogin(
    (!isError && data) || defaultLoginContent(),
    currentLang as SiteLang,
  );
  return { texts, ready: !isPending };
}
