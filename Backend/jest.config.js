/**
 * إعداد Jest للخلفية.
 *
 * ثلاث قرارات تستحقّ الشرح:
 *
 * 1. `setupFiles` يحمّل `.env.test` **قبل** أي استيراد، لأن `core/prisma/client`
 *    يقرأ `DATABASE_URL` لحظة تحميله. لو حُمّل المتغيّر بعده لاتّصلت
 *    الاختبارات بقاعدة التطوير وكتبت فيها.
 *
 * 2. `maxWorkers: 1` — اختبارات التكامل تتشارك قاعدة واحدة وتُنشئ صفوفاً
 *    بمفاتيح فريدة. تشغيلها بالتوازي يجعلها تتصادم وتفشل عشوائياً، وهو أسوأ
 *    من بطئها: اختبار يفشل مرّةً وينجح مرّة لا يُوثَق به ولا يُصلَح.
 *
 * 3. `src/generated` مستبعَد من كل شيء — عميل Prisma المولَّد عشرات آلاف
 *    الأسطر، لا تُقرأ ولا تُقاس تغطيتها.
 */
/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",

  // الاختبارات تُصرَّف بإعدادها الخاصّ، لا بإعداد البناء.
  transform: {
    "^.+\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }],
  },

  rootDir: ".",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],

  setupFiles: ["<rootDir>/tests/load-env.ts"],

  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/src/generated/"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],

  maxWorkers: 1,
  // مهلة سخيّة عمداً: البذر والتفكيك يمسّان قاعدة حقيقية، وانقضاء المهلة
  // في `beforeAll` لا يُفشل الخطّاف وحده — يقطعه بينما الكتابة جارية فيسقط
  // ما بعده بأخطاء مفاتيح أجنبية لا علاقة لها بالسبب.
  testTimeout: 60000,
  clearMocks: true,
  restoreMocks: true,

  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/generated/**",
    "!src/**/*.d.ts",
    "!src/server.ts",
    "!src/seeders/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "html", "lcov"],
};

module.exports = config;
