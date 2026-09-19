import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const API = "http://localhost:3000";

/**
 * كل ما تحتاجه الواجهة من الخلفية يمرّ من هنا بمسارٍ نسبيّ.
 *
 * `/socket.io` بـ`ws: true` لأن السوكيت يرقّي الاتّصال إلى WebSocket، ووسيطٌ
 * بلا هذه الراية يمرّر المصافحة الأولى ثم يقطع الترقية — فيبدو الاتّصال
 * وكأنه نجح ثم صمت.
 */
const proxy = {
  "/api": API,
  "/uploads": API,
  "/socket.io": { target: API, ws: true },
};

export default defineConfig(({ mode }) => {
  // `npm run dev:tunnel` — التشغيل خلف نفقٍ (VS Code Dev Tunnels وأمثاله).
  const tunnel = mode === "tunnel";

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: {
      // النفق يصل باسمٍ عشوائيّ لا يعرفه Vite، فيردّ الطلب بـ«Blocked
      // request». والسماح مقصورٌ على نطاق الأنفاق لا على كل مضيف.
      allowedHosts: [".devtunnels.ms"],
      proxy,
      // عبر النفق تُقدَّم الصفحة على 443/https، وHMR الافتراضيّ يقصد المنفذ
      // 5173 فيفشل ويملأ الطرفية بأخطاء WebSocket. ومحلياً يبقى الافتراض.
      hmr: tunnel ? { clientPort: 443, protocol: "wss" } : undefined,
    },
    // نفس التوجيه لخادم المعاينة. اختبارات المتصفّح تعمل على البناء لا على
    // خادم التطوير — أسرع، وأقرب إلى ما يصل المستخدم فعلاً — ولولا هذا لَذهب
    // كل نداء `/api` منها إلى العدم.
    preview: {
      allowedHosts: [".devtunnels.ms"],
      proxy,
    },
  };
});
