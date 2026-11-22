import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider, type QueryKey } from "@tanstack/react-query";
import type { AxiosAdapter } from "axios";
import { toast } from "sonner";
import "../i18n/i18n";
import { client } from "../lib/api/client";
import { useAuthStore } from "../store/auth.store";
import * as admin from "./admin/hooks/admin-hook";
import * as homeSlides from "./admin/hooks/home-slides-hook";
import * as siteContent from "./admin/hooks/site-content-hook";
import * as site from "./home/hooks/site-hook";
import * as chat from "./messages/hooks/chat-hooks";
import * as messages from "./messages/hooks/messages-hook";
import * as professor from "./professor/hooks/Professor-hook";
import * as pub from "./public/hooks/public-hook";
import * as student from "./student/hooks/Student-hook";
import * as supervision from "./supervision/hooks/supervision-hook";
import * as account from "./account/account.api";
import * as me from "./auth/hooks/use-me";
import * as login from "./auth/hooks/use-login";
import * as topicLookups from "../hooks/use-topic-lookups";

/**
 * خطّافات البيانات كلّها — بلا محاكاةٍ لطبقة الـAPI.
 *
 * كلّ خطّافٍ يُرسم ويُنادى حقيقةً، والطلب يصل محوِّلاً يجيب ببياناتٍ عامّة أو
 * يرفض. وما يُحرس فيها كلّها خطآن لا يُرى أيٌّ منهما في الشاشة إلا متأخّراً:
 *
 *   **رسالةٌ بلا ترجمة** — `t("toast.x")` لمفتاحٍ غائب يُعيد المفتاح نفسه،
 *   فيرى المستخدم «toast.userCreated» بدل جملة.
 *
 *   **إبطالٌ لمفتاحٍ لا يقرؤه أحد** — خطأٌ في اسم المفتاح (["admin","facultys"])
 *   يعني أنّ الشاشة لا تتحدّث بعد التغيير، بلا أيّ خطأ.
 */
vi.mock("sonner", () => {
  const fn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    custom: vi.fn(),
    promise: vi.fn(),
  });
  return { toast: fn, Toaster: () => null };
});

let failing = false;
const adapter: AxiosAdapter = async (config) => {
  const data = {
    items: [],
    data: [],
    slides: [],
    total: 0,
    count: 0,
    created: 0,
    page: 1,
    limit: 20,
    user: { id: "u1" },
    account: { id: "u1" },
    accessToken: "t",
  };
  if (failing) {
    const { AxiosError } = await import("axios");
    throw new AxiosError("fail", "ERR_BAD_RESPONSE", config, {}, {
      data: { message: "تعذّر" },
      status: 500,
      statusText: "",
      headers: {},
      config,
    });
  }
  return { data, status: 200, statusText: "OK", headers: {}, config };
};

const MODULES = { admin, homeSlides, siteContent, site, chat, messages, professor, pub, student, supervision, account, me, login, topicLookups } as Record<
  string,
  Record<string, unknown>
>;

type Report = { name: string; kind: "query" | "mutation" | "other" | "broken"; ok?: boolean; error?: string };
const reports: Report[] = [];
const queryKeys: QueryKey[] = [];
const invalidated: { by: string; key: QueryKey }[] = [];
const toasts: { by: string; text: string }[] = [];

const ARGS: unknown[][] = [["x1", "x2"], [{}], []];
const VARS: unknown[] = [{ id: "x1", data: {}, ids: ["x1"] }, {}, "x1", ["x1"]];

beforeAll(async () => {
  client.defaults.adapter = adapter;
  useAuthStore.setState({ accessToken: "t", isAuthenticated: true, user: { id: "u1", role: "admin" } as never });

  for (const [mod, exports] of Object.entries(MODULES))
    for (const [fn, hook] of Object.entries(exports)) {
      if (!/^use[A-Z]/.test(fn) || typeof hook !== "function") continue;
      const name = `${mod}.${fn}`;
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      const realInvalidate = qc.invalidateQueries.bind(qc);
      qc.invalidateQueries = ((filters?: { queryKey?: QueryKey }) => {
        if (filters?.queryKey) invalidated.push({ by: name, key: filters.queryKey });
        return realInvalidate(filters);
      }) as typeof qc.invalidateQueries;
      const wrapper = ({ children }: { children: ReactNode }) => (
        <MemoryRouter>
          <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </MemoryRouter>
      );
      let rendered: ReturnType<typeof renderHook<unknown, unknown>> | null = null;
      let error = "";
      for (const args of ARGS) {
        try {
          rendered = renderHook(() => (hook as (...a: unknown[]) => unknown)(...args), { wrapper });
          break;
        } catch (e) {
          error = String(e);
        }
      }
      if (!rendered) {
        reports.push({ name, kind: "broken", error });
        continue;
      }
      const result = rendered.result as { current: Record<string, unknown> };
      vi.mocked(toast.success).mockClear();
      vi.mocked(toast.error).mockClear();

      if (typeof result.current?.mutateAsync === "function") {
        let ok = false;
        for (const v of VARS) {
          failing = false;
          try {
            await act(() => (result.current.mutateAsync as (x: unknown) => Promise<unknown>)(v));
            ok = true;
            break;
          } catch {
            /* جرّب غيرها */
          }
        }
        failing = true;
        await act(() => (result.current.mutateAsync as (x: unknown) => Promise<unknown>)(VARS[0]).catch(() => undefined));
        failing = false;
        reports.push({ name, kind: "mutation", ok });
      } else if (typeof result.current?.refetch === "function") {
        await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
        reports.push({ name, kind: "query", ok: result.current.status !== "error" });
      } else reports.push({ name, kind: "other" });

      for (const q of qc.getQueryCache().getAll()) queryKeys.push(q.queryKey);
      for (const call of [...vi.mocked(toast.success).mock.calls, ...vi.mocked(toast.error).mock.calls])
        if (typeof call[0] === "string") toasts.push({ by: name, text: call[0] });
      rendered.unmount();
      qc.clear();
    }
}, 120_000);

afterAll(() => {
  if (process.env.HOOKS_REPORT)
    console.log(JSON.stringify({ reports: reports.filter((r) => r.kind === "broken" || r.ok === false), toasts, invalidated }, null, 1));
});

describe("خطّافات البيانات", () => {
  it("كلّها تُرسم", () => {
    expect(reports.filter((r) => r.kind === "broken")).toEqual([]);
    expect(reports.length).toBeGreaterThan(150);
  });

  it("كلّ رسالةٍ تظهر مترجمة — لا مفتاحٌ مكان الجملة", () => {
    expect(toasts.length).toBeGreaterThan(50);
    expect(toasts.filter((t) => /^[a-z][\w-]*(\.[\w-]+)+$/i.test(t.text))).toEqual([]);
  });

  it("وكلّ مفتاحٍ يُبطَل يقرؤه خطّافٌ ما", () => {
    // جزءٌ فارغ (null) معرّفٌ لم تحمله القيم العامّة هنا: يطابق أيّ معرّف.
    const isPrefix = (p: QueryKey, k: QueryKey) =>
      p.length <= k.length && p.every((part, i) => part == null || JSON.stringify(part) === JSON.stringify(k[i]));
    const dangling = invalidated
      .filter(({ key }) => !queryKeys.some((k) => isPrefix(key, k)))
      .map(({ by, key }) => `${by} → ${JSON.stringify(key)}`);
    expect([...new Set(dangling)]).toEqual([]);
  });
});
