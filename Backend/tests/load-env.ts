/**
 * يحمّل `.env.test` قبل أي وحدة أخرى، ويرفض التشغيل على قاعدة غير اختبارية.
 *
 * الترتيب هو كل شيء هنا: `core/prisma/client` يقرأ `DATABASE_URL` لحظة
 * تحميله، فلو وصل هذا الملفّ بعده لاتّصلت الاختبارات بقاعدة التطوير — وهي
 * تُنشئ الصفوف وتحذفها، فالخطأ لا يُكتشف إلا بعد ضياع البيانات. لذلك هو في
 * `setupFiles` لا `setupFilesAfterEnv`.
 *
 * والحارس تحته ليس زائداً: ملفّ `.env.test` مفقود أو مضبوط خطأً يجعل الحمل
 * يقع صامتاً على قاعدة التطوير، وهذا بالضبط ما يجب أن يستحيل.
 */
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: path.join(__dirname, "..", ".env.test"),
  override: true,
  // بلا سطر الدعاية الذي يطبعه dotenv في مخرجات كل تشغيل.
  quiet: true,
});

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL غير مضبوط. أنشئ Backend/.env.test — انظر tests/README.md.",
  );
}

// اسم القاعدة هو آخر مقطع، قبل أي معاملات استعلام.
const dbName = url.split("/").pop()?.split("?")[0] ?? "";

if (!/_test$/.test(dbName)) {
  throw new Error(
    `الاختبارات تُنشئ الصفوف وتحذفها، ورُفض التشغيل على قاعدة اسمها «${dbName}».\n` +
      "يجب أن ينتهي اسم قاعدة الاختبار بـ `_test`. راجع Backend/.env.test.",
  );
}
