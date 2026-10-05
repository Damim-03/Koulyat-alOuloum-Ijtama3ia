import { env } from "../../config/env";

/**
 * هل يُجيب الخادم أصلاً؟ يسأله مراقبُ الاتّصال ليعرف أيَّ الطرفين تعطّل:
 * اتّصالُ الجهاز، أم الخادم، أم طلبٌ واحد.
 *
 * `GET /api/health` عامٌّ بلا بيانات؛ وأيُّ خطأ — انقطاعٌ، أو 502 من الوسيط
 * حين يكون الخادم متوقّفاً، أو انتهاءُ المهلة — جوابُه «لا».
 *
 * بـ`fetch` لا بـ`client`: عميلُ axios يُبلغ المراقبَ بكلّ فشل، والمراقبُ
 * يستدعي هذه — فلو مرّت بـaxios لدارت الحلقة على نفسها.
 */
export async function pingServer(timeoutMs = 4000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.VITE_API_URL}/health`, { cache: "no-store", signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
