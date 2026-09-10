/**
 * جرد المسارات: أيّها له اختبار سلوك، وأيّها لا.
 *
 * التغطية بالنسبة المئوية تقول «كم سطراً نُفِّذ»، ولا تقول **أي مسار ما يزال
 * بلا وعدٍ محروس**. وهذا السكربت يقول ذلك: يقرأ المسارات من ملفّات التوجيه،
 * ثم يبحث عن كلٍّ منها في ملفّات الاختبار.
 *
 * وكنسة الحُرّاس (`route-guards.api.test.ts`) تغطّي المسارات كلّها من ناحية
 * المصادقة والدور، فهي مستثناة من البحث هنا عمداً: السؤال ليس «هل هو محروس؟»
 * — كلّها محروسة — بل **«هل نعرف ماذا يفعل حين يُسمح له؟»**
 *
 * يُشغَّل: npm run endpoints
 */
import fs from "node:fs";
import path from "node:path";
import { allEndpoints, type Endpoint } from "../tests/helpers/routes";

const TESTS_DIR = path.join(__dirname, "..", "tests");
const SRC_DIR = path.join(__dirname, "..", "src");

/** الكنسة تغطّي الكلّ بالحُرّاس، فلا تُحتسب اختبارَ سلوك. */
const SWEEP = "route-guards.api.test.ts";

function testSources(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.test\.ts$/.test(entry.name) && entry.name !== SWEEP)
        files.push(fs.readFileSync(full, "utf8"));
    }
  };
  walk(TESTS_DIR);
  walk(SRC_DIR);
  return files;
}

/** `/api/admin/topics/:id` ⇒ نمطٌ يقبل أي قيمة أو قالباً نصّياً مكان المعامل. */
function pathPattern(p: string): RegExp {
  const escaped = p
    .split("/")
    .map((seg) =>
      seg.startsWith(":")
        ? "[^/\"'`\\s]+"
        : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(escaped);
}

const sources = testSources();
const tested = (e: Endpoint) => {
  const re = pathPattern(e.path);
  return sources.some((s) => re.test(s));
};

const all = allEndpoints();
const byModule = new Map<string, { covered: Endpoint[]; missing: Endpoint[] }>();

for (const e of all) {
  if (!byModule.has(e.module))
    byModule.set(e.module, { covered: [], missing: [] });
  byModule.get(e.module)![tested(e) ? "covered" : "missing"].push(e);
}

const bar = (n: number, total: number, width = 22) => {
  const filled = total === 0 ? 0 : Math.round((n / total) * width);
  return "█".repeat(filled) + "·".repeat(width - filled);
};

console.log("═".repeat(72));
console.log("  اختبارات السلوك لكل مسار");
console.log("  (الحُرّاس مغطّاة كلّها في route-guards.api.test.ts)");
console.log("═".repeat(72));

let totalCovered = 0;
const ordered = [...byModule.entries()].sort(
  (a, b) => b[1].missing.length - a[1].missing.length,
);

for (const [mod, { covered, missing }] of ordered) {
  const total = covered.length + missing.length;
  totalCovered += covered.length;
  const pct = Math.round((covered.length / total) * 100);
  console.log(
    `\n${mod.padEnd(11)} ${bar(covered.length, total)}  ${String(covered.length).padStart(2)}/${total}  (${pct}%)`,
  );
  if (missing.length) {
    for (const e of missing) console.log(`    ✗ ${e.method.padEnd(6)} ${e.path}`);
  }
}

const total = all.length;
console.log("\n" + "─".repeat(72));
console.log(
  `  ${totalCovered}/${total} مساراً له اختبار سلوك  ` +
    `(${Math.round((totalCovered / total) * 100)}%)`,
);
console.log(`  والباقي ${total - totalCovered} مساراً محروسٌ بلا وعدٍ موصوف.`);
