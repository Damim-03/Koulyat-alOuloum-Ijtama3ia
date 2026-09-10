import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * اختبارات المتصفّح.
 *
 * الخلفية موصوفةٌ بالكامل — ١٣٢ مساراً لكلٍّ منها اختبار — والشاشات لم يرها
 * اختبارٌ قطّ. وما بين الاثنين طبقةٌ كاملة لا يمسّها شيء: التوجيه، والحُرّاس،
 * وحفظ الرمز، وعرض ما يردّه الخادم. فخادمٌ يردّ ٤٠٣ صحيحةً وشاشةٌ تعرضها
 * صفحةً بيضاء ليسا نجاحاً.
 *
 * وثلاثة قرارات تستحقّ الشرح:
 *
 * ١. **قاعدة الاختبار لا قاعدة التطوير.** الخلفية تُشغَّل بـ`dev:e2e` الذي
 *    يُحمّل `.env.test`، فيمرّ بالحارس نفسه الذي يرفض أي قاعدة لا ينتهي
 *    اسمها بـ`_test`. وبدون ذلك كان المتصفّح سيكتب في بيانات العمل الحقيقية
 *    — وهو أسوأ ما يفعله اختبار.
 *
 * ٢. **منفذ ٣٠٠٠ صراحةً.** وسيط Vite يوجّه `/api` إلى `localhost:3000`،
 *    و`.env.test` تضع `PORT=0` لاختبارات Jest. فيُعاد ضبطه هنا بـ`dotenv -v`.
 *
 * ٣. **`workers: 1`.** الخوادم والقاعدة مشتركة، والتوازي يجعل اختباراً يحذف
 *    ما يقرأه آخر. البطء هنا أرخص من فشلٍ يظهر ويختفي.
 */

// الحزمة من نوع ESM، فلا وجود لـ`__dirname`.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, "..", "Backend");

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.artifacts",

  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: "http://127.0.0.1:5173",
    // الأثر يُحفظ عند الفشل وحده: تشغيلٌ أخضر لا يترك شيئاً على القرص.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "ar",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: [
    {
      command: "npm run dev:e2e",
      cwd: BACKEND,
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !process.env.CI,
      // الخلفية تُقرأ من المصدر مباشرةً بـ`tsx`، فلا بناء يمكن أن يَبلى.
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // البناء ثم المعاينة، لا خادم التطوير.
      //
      // Vite يُحوّل الوحدات عند الطلب، فأوّل تحميلٍ لصفحةٍ في تطبيقٍ بهذا
      // الحجم تجاوز ثلاثين ثانية ولم يُنهِ حدث `load` — فسقط كل اختبارٍ يفتح
      // صفحة. والمعاينة تُقدّم أصولاً مبنيّة: أسرع وأثبت، وفوق ذلك تختبر ما
      // يصل المستخدم فعلاً لا ما يراه المطوّر.
      //
      // و`--host 127.0.0.1` صراحةً: Vite يستمع على `::1` وحده افتراضاً على
      // ويندوز، فيتّصل المتصفّح بينما ينتظر Playwright على IPv4 بلا نهاية.
      command:
        "npm run build && npm run preview -- --port 5173 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      // **لا إعادة استعمال لخادمٍ قائم — أبداً.**
      //
      // هذه ليست مبالغة: جرّبتُها. عطّلتُ حارس الدور في العميل ثم شغّلتُ كل
      // الاختبارات فمرّت الستّ والثلاثون خضراء — لأن خادم المعاينة كان يُقدّم
      // بناءً سابقاً لا يحوي الكسر. ثم أعدتُ البناء فاحمرّت ثلاثة اختبارات
      // كما ينبغي.
      //
      // وإعدادٌ يستطيع أن يختبر شيفرةً قديمةً بلا أن يقول أسوأ من إعدادٍ بطيء:
      // البطء يُرى، والاختبار على بناءٍ بالٍ يُطمئن كذباً. والثمن دقيقةُ بناء.
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: "ignore",
      stderr: "pipe",
    },
  ],
});
