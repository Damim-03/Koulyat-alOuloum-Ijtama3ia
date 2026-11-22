/**
 * تشغيلٌ واحد لقاعدة الاختبار في كلّ وقت.
 *
 * كلّ ملفّ اختبارٍ يبذر صفوفه بالوسم نفسه (`__TEST__`) ثم يمحو كلّ ما يحمله.
 * فتشغيلان معاً — من طرفيتين، أو تقرير تغطيةٍ في الخلفية وتشغيلٌ يدويّ — يمحو
 * كلٌّ منهما بيانات الآخر في منتصف عمله: «Unique constraint failed» في البذر،
 * و«Foreign key constraint violated» في التفكيك، ومئات الإخفاقات لا سبب لها
 * في الشيفرة. وقد وقع ذلك مرّتين قبل أن يُكتب هذا الملف.
 *
 * فيحجز التشغيلُ قفلاً مسمّى في القاعدة نفسها (`GET_LOCK`) على اتّصالٍ يبقى
 * مفتوحاً حتى آخره، ومن يجده محجوزاً يقف فوراً ويقول لماذا. والقفل مربوطٌ
 * بالاتّصال: تشغيلٌ قُطع بـCtrl+C أو تعطّل يُفكّ قفله معه، فلا يبقى عالقاً.
 *
 * وقاعدةٌ لا تُبلغ لا تمنع شيئاً: الاختبارات الوحدوية لا تحتاجها، واختبارات
 * الـAPI ستقول بنفسها إنها لا تتّصل.
 */
import path from "node:path";
import dotenv from "dotenv";
import * as mariadb from "mariadb";

export const RUN_LOCK = "kouliate_ouloum_test_run";

declare global {
  // eslint-disable-next-line no-var
  var __testRunLock: mariadb.Connection | undefined;
}

export default async function globalSetup() {
  // `setupFiles` لم يجرِ بعد هنا: البيئة تُقرأ من الملف مباشرةً.
  dotenv.config({ path: path.join(__dirname, "..", ".env.test"), override: true, quiet: true });
  const raw = process.env.DATABASE_URL;
  if (!raw) return;

  let conn: mariadb.Connection;
  try {
    const url = new URL(raw);
    conn = await mariadb.createConnection({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      connectTimeout: 5000,
    });
  } catch {
    return;
  }

  const [row] = await conn.query("SELECT GET_LOCK(?, 0) AS got", [RUN_LOCK]);
  if (Number(row?.got) !== 1) {
    await conn.end();
    throw new Error(
      "\n\nتشغيلٌ آخر للاختبارات يعمل الآن على قاعدة الاختبار — من طرفيةٍ أخرى، أو تقرير تغطيةٍ في الخلفية.\n" +
        "تشغيلان معاً يمحو كلٌّ منهما بيانات الآخر. انتظر حتى ينتهي، ثم أعد التشغيل.\n",
    );
  }
  globalThis.__testRunLock = conn;
}
