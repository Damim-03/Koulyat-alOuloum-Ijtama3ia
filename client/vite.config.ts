import { defineConfig, type Plugin } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

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

/**
 * pdf.js's own files, served by this site under `/pdfjs/`: the data of the
 * standard PDF fonts (a PDF may name Helvetica without carrying it), the
 * WebAssembly decoders of some image formats found in scanned documents, and
 * a colour profile.
 * From the site, not from the internet — a university intranet may have
 * none. In development they are read from node_modules; a build copies them.
 */
function pdfjsAssets(): Plugin {
  const root = path.resolve(__dirname, "node_modules/pdfjs-dist");
  const wanted: Record<string, RegExp> = {
    standard_fonts: /^[\w-]+\.(pfb|ttf)$/,
    wasm: /^(openjpeg|jbig2|qcms_bg)\.wasm$/,
    iccs: /^[\w-]+\.icc$/,
  };
  return {
    name: "pdfjs-assets",
    configureServer(server) {
      server.middlewares.use("/pdfjs", (req, res, next) => {
        const [dir = "", file = ""] = (req.url ?? "").split("?")[0]!.replace(/^\//, "").split("/");
        if (!wanted[dir]?.test(file)) return next();
        const p = path.join(root, dir, file);
        if (!fs.existsSync(p)) return next();
        res.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : "application/octet-stream");
        fs.createReadStream(p).pipe(res);
      });
    },
    generateBundle() {
      for (const [dir, rule] of Object.entries(wanted))
        for (const file of fs.readdirSync(path.join(root, dir)).filter((f) => rule.test(f)))
          this.emitFile({ type: "asset", fileName: `pdfjs/${dir}/${file}`, source: fs.readFileSync(path.join(root, dir, file)) });
    },
  };
}

export default defineConfig(({ mode }) => {
  // `npm run dev:tunnel` — التشغيل خلف نفقٍ (VS Code Dev Tunnels وأمثاله).
  const tunnel = mode === "tunnel";

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      pdfjsAssets(),
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
