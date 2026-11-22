import { defineConfig } from "prisma/config";
import "dotenv/config";

/**
 * يقرأ `DATABASE_URL` مباشرةً لا من `app.config`: ذاك يتحقّق من كل أسرار
 * الإنتاج ويُنهي العملية إن نقص أحدها، فكان `prisma generate` أثناء بناء صورة
 * Docker و`prisma migrate deploy` يتوقّفان لغياب أسرار JWT لا شأن لهما بها.
 */
export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
