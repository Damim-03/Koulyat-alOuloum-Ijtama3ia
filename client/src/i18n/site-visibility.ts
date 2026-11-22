import { useCallback, useSyncExternalStore } from "react";
import { cachedTexts } from "./site-texts";

/**
 * ما أخفته الإدارة من الموقع — من «واجهة الموقع ← النصوص»: سطرٌ، أو زرّ، أو
 * قسمٌ كامل، أو رابطٌ في قائمةٍ جانبية. والإخفاء للّغات كلّها، ويُحفظ نصّ
 * المخفيّ كما هو فيعود إن أُظهر.
 *
 * كلّ عنصرٍ يُخفى له معرّفٌ ثابت («home.news»، «footer.phone»،
 * «sidebar.admin.dash.archive»)، والمكوّن يسأل `shown(id)`. ومعرّفٌ لا
 * يسأل عنه أحدٌ لا يُخفي شيئاً.
 */

let hidden: ReadonlySet<string> = new Set(cachedTexts?.hidden ?? []);
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** يضع قائمة المخفيّ؛ والقائمة نفسها لا تُعيد رسم شيء. */
export function setHidden(ids: readonly string[]) {
  const next = new Set(ids);
  if (next.size === hidden.size && [...next].every((id) => hidden.has(id))) return;
  hidden = next;
  listeners.forEach((l) => l());
}

/** `shown(id)` — أظاهرٌ هذا العنصر في الموقع؟ */
export function useShown(): (id: string) => boolean {
  const snapshot = useSyncExternalStore(subscribe, () => hidden, () => hidden);
  return useCallback((id: string) => !snapshot.has(id), [snapshot]);
}
