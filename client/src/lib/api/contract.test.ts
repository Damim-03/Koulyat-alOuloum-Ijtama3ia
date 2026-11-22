import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { AxiosAdapter } from "axios";
import { client } from "./client";
import { useAuthStore } from "../../store/auth.store";
import { adminApi } from "../../features/admin/api/admin.api";
import { authApi } from "../../features/auth/api/auth.api";
import { siteApi } from "../../features/home/api/site.api";
import { messagesApi } from "../../features/messages/api/messages.api";
import { professorApi } from "../../features/professor/api/professor.api";
import { publicApi } from "../../features/public/api/public.api";
import { studentApi } from "../../features/student/api/Student-api";
import { supervisionApi } from "../../features/supervision/api/supervision.api";
import { accountApi } from "../../features/account/account.api";
import { topicLookupsApi } from "./topic-lookups";

/**
 * العقد بين الواجهة والخادم — كلّ طلبٍ ترسله الواجهة له مسارٌ في الخادم.
 *
 * مسارٌ كُتب خطأً، أو غُيّر اسمه في الخادم ولم يُغيَّر هنا، لا يكشفه اختبارٌ
 * في أحد الطرفين وحده: كلاهما ينجح، والمستخدم يرى 404. فهنا تُقرأ مسارات
 * الخادم من ملفّاتها، وتُنادى كلّ دالّةٍ في طبقة الـAPI بمحوِّلٍ يسجّل ما
 * تطلبه، ويُطابَق كلّ طلبٍ بمسارٍ بالطريقة نفسها.
 */
const BACKEND = path.resolve(__dirname, "../../../../Backend/src");

type Route = { method: string; pattern: RegExp; path: string };

/** مسارات الخادم: ما يُركَّب في mainRoutes، وما يعرّفه كلّ موجِّه. */
function backendRoutes(): Route[] {
  const main = fs.readFileSync(path.join(BACKEND, "routes/mainRoutes.ts"), "utf8");
  const prefix = new Map<string, string>();
  for (const m of main.matchAll(/mainRoute\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)) prefix.set(m[2]!, m[1]!);

  const routes: Route[] = [];
  const modules = path.join(BACKEND, "modules");
  for (const mod of fs.readdirSync(modules)) {
    const dir = path.join(modules, mod);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".routes.ts"))) {
      const src = fs.readFileSync(path.join(dir, file), "utf8");
      for (const m of src.matchAll(/(\w+)\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g)) {
        const base = prefix.get(m[1]!);
        if (base === undefined) continue;
        const full = `/api${base}${m[3] === "/" ? "" : m[3]}`;
        routes.push({
          method: m[2]!,
          path: full,
          pattern: new RegExp(`^${full.replace(/:\w+/g, "[^/]+")}/?$`),
        });
      }
    }
  }
  return routes;
}

type Seen = { api: string; fn: string; method: string; path: string };
const seen: Seen[] = [];
let current = { api: "", fn: "" };

const adapter: AxiosAdapter = async (config) => {
  const url = `${config.baseURL ?? ""}${config.url ?? ""}`.split("?")[0]!;
  seen.push({ ...current, method: (config.method ?? "get").toLowerCase(), path: url });
  return { data: { items: [], data: [] }, status: 200, statusText: "OK", headers: {}, config };
};

const APIS = {
  adminApi,
  authApi,
  siteApi,
  messagesApi,
  professorApi,
  publicApi,
  studentApi,
  supervisionApi,
  accountApi,
  topicLookupsApi,
} as Record<string, Record<string, unknown>>;

/** قيمٌ لكلّ مُعامِل: معرّفات، وأجسام، وملفّات — أوّل ما يصلح منها. */
const TRIES: unknown[][] = [
  ["x1", "x2", "x3"],
  [{}, {}, {}],
  [new File(["x"], "a.png"), "x2", "x3"],
  [["x1"], "x2", "x3"],
];

let routes: Route[] = [];
const unreached: string[] = [];

beforeAll(async () => {
  routes = backendRoutes();
  client.defaults.adapter = adapter;
  useAuthStore.setState({ accessToken: "t", isAuthenticated: true, user: null });

  for (const [api, obj] of Object.entries(APIS))
    for (const [fn, value] of Object.entries(obj)) {
      if (typeof value !== "function") continue;
      current = { api, fn };
      const before = seen.length;
      for (const args of TRIES) {
        try {
          await (value as (...a: unknown[]) => unknown)(...args);
        } catch {
          /* جرّب غيرها */
        }
        if (seen.length > before) break;
      }
      if (seen.length === before) unreached.push(`${api}.${fn}`);
    }
});

describe("العقد بين الواجهة والخادم", () => {
  it("مسارات الخادم قُرئت، والمطابقة تفرّق بين الموجود وغيره", () => {
    expect(routes.length).toBeGreaterThan(200);
    const matches = (method: string, p: string) => routes.some((r) => r.method === method && r.pattern.test(p));
    expect(matches("get", "/api/admin/users/u-1")).toBe(true);
    expect(matches("delete", "/api/admin/users/u-1")).toBe(true);
    expect(matches("put", "/api/admin/users/u-1")).toBe(false);
    expect(matches("get", "/api/admin/no-such-thing")).toBe(false);
    expect(matches("get", "/api/admin/users/u-1/extra/segment")).toBe(false);
  });

  it("كلّ دالّةٍ في طبقة الـAPI ترسل طلباً", () => {
    expect(unreached).toEqual([]);
    expect(seen.length).toBeGreaterThan(150);
  });

  it("وكلّ طلبٍ يقابله مسارٌ في الخادم بطريقته", () => {
    const orphans = seen
      .filter((s) => !routes.some((r) => r.method === s.method && r.pattern.test(s.path)))
      .map((s) => `${s.api}.${s.fn} → ${s.method.toUpperCase()} ${s.path}`);
    expect(orphans).toEqual([]);
  });
});
