/**
 * جرد مسارات الـAPI، مقروءاً من ملفّات التوجيه نفسها.
 *
 * الغرض منه اختبارٌ واحد يكنس **كل** مسار: هل هو محميّ؟ لأن أشيع ثغرة في أي
 * واجهة برمجية ليست منطقاً خاطئاً، بل **مساراً أُضيف ونُسي حارسه**. ولا يظهر
 * ذلك في مراجعة شيفرة — السطر يبدو كإخوته تماماً — ولا في تغطية، لأن المسار
 * الجديد يعمل ويُختبَر مسار نجاحه.
 *
 * والقراءة من الملفّات لا من كائن Express عمداً: بنية الموجّه الداخلية تغيّرت
 * في Express 5 (`matchers` بدل `regexp`) وستتغيّر ثانيةً، أمّا `adminRoutes.get(
 * "/topics", ...)` فصيغة مستقرّة يقرؤها الإنسان والآلة.
 *
 * والأهمّ: مسارٌ يُضاف غداً إلى أي ملفّ يدخل هذا الجرد **تلقائياً**، فيُكنَس
 * بلا أن يتذكّر أحد شيئاً.
 */
import fs from "node:fs";
import path from "node:path";

export type Endpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** المسار الكامل كما يُطلَب، مثل `/api/admin/topics/:id`. */
  path: string;
  /** الوحدة، لتجميع النتائج وقراءتها. */
  module: string;
};

/** بادئة كل موجّه، من `mainRoutes.ts`. */
const MOUNTS: Record<string, string> = {
  auth: "/api/auth",
  messages: "/api/messages",
  admin: "/api/admin",
  professor: "/api/professor",
  student: "/api/student",
  common: "/api/common",
  public: "/api/public",
};

const MODULES_DIR = path.join(__dirname, "..", "..", "src", "modules");

/**
 * `adminRoutes.get(` أو `adminRoutes.delete(` … ثم أوّل نصّ بين علامتَي
 * اقتباس هو المسار. الصيغة موحّدة في كل ملفّات المشروع.
 */
const ROUTE_CALL = /\b\w+Routes\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;

let cache: Endpoint[] | null = null;

export function allEndpoints(): Endpoint[] {
  if (cache) return cache;

  const found: Endpoint[] = [];

  for (const [moduleName, mount] of Object.entries(MOUNTS)) {
    const file = path.join(
      MODULES_DIR,
      moduleName,
      `${moduleName}.routes.ts`,
    );
    const source = fs.readFileSync(file, "utf8");

    for (const m of source.matchAll(ROUTE_CALL)) {
      const method = m[1].toUpperCase() as Endpoint["method"];
      const sub = m[2] === "/" ? "" : m[2];
      found.push({ method, path: mount + sub, module: moduleName });
    }
  }

  if (found.length === 0) {
    throw new Error(
      "لم يُعثر على أي مسار — تغيّرت صيغة ملفّات التوجيه، فحدّث ROUTE_CALL.",
    );
  }

  cache = found;
  return found;
}

/**
 * يستبدل معاملات المسار بمعرّفات صالحة الشكل وغير موجودة.
 *
 * الغرض بلوغ الحارس لا بلوغ البيانات: مسارٌ محميّ يجب أن يردّ 401 قبل أن
 * يسأل القاعدة عن شيء، فلا يهمّ أن المعرّف لا يقابل صفّاً.
 */
export const concretePath = (p: string) =>
  p.replace(/:[A-Za-z0-9_]+/g, "00000000-0000-0000-0000-000000000000");
