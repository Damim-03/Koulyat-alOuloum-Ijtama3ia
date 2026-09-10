import "dotenv/config";
import { PrismaClient } from "../../generated/prisma";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { config } from "../config/app.config";

// الاتصال يُقرأ من DATABASE_URL في ملف .env — نفس المصدر الذي تستعمله
// prisma.config.ts للـ migrations، حتى لا تنفصل الشيفرة عن القاعدة المُهاجَرة.
if (!config.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to Backend/.env, e.g.\n" +
      '  DATABASE_URL="mysql://user:password@127.0.0.1:3307/kouliate_ouloum"',
  );
}

const adapter = new PrismaMariaDb(config.DATABASE_URL);

export const prisma = new PrismaClient({
  adapter,
  /**
   * صيغة الخطأ.
   *
   * الصيغة الافتراضية تطبع مقتطفاً من «الشيفرة المحيطة» بموضع الخطأ — وموضع
   * الخطأ داخل عميل Prisma المولَّد، وهو ملفّ مصغَّر بأسطر طولها آلاف
   * الأحرف. فخطأٌ واحد في اختبار يُغرق المخرجات بثلاث شاشات من شيفرة لا
   * تخصّك، ويدفن السبب الحقيقي بينها.
   *
   * `minimal` تطبع الرسالة والرمز فقط: «Foreign key constraint violated on
   * the fields: (userId)» — وهو كل ما يلزم.
   */
  errorFormat: config.NODE_ENV === "test" ? "minimal" : "colorless",
});
