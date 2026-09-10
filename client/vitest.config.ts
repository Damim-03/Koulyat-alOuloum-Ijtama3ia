import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

/**
 * إعداد اختبارات الواجهة.
 *
 * `mergeConfig` مع `vite.config` هو سبب اختيار Vitest هنا: الأسماء المستعارة
 * للمسارات، وإضافات React، وكل ما تحتاجه الواجهة لتُصرَّف — معرَّف مرّة واحدة
 * ويُستعمل في التطوير والبناء والاختبار معاً. أي مشغّل آخر يعني إعداداً
 * موازياً يجب أن يبقى مطابقاً يدوياً، وهو ما لا يبقى مطابقاً أبداً.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // مكوّنات React تحتاج DOM.
      environment: "jsdom",

      // مجمّع الخيوط لا العمليات: مجمّع `forks` الافتراضي يفشل في بدء عامل
      // على هذا المسار (فيه مسافة، تُرمَّز %20 داخل Vitest) فيتوقّف التشغيل
      // بمهلة بلا تشغيل اختبار واحد. والخيوط أسرع هنا على كل حال.
      pool: "threads",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      css: false,
      coverage: {
        provider: "v8",
        reportsDirectory: "coverage",
        reporter: ["text", "html", "lcov"],
        exclude: [
          "src/main.tsx",
          "src/**/*.d.ts",
          "src/test/**",
          "src/i18n/**",
        ],
      },
    },
  }),
);
