/**
 * يرسم الواجهة كلّها عند مسار — بموجِّهها وتخطيطاتها وحرّاسها الحقيقية.
 *
 * ما يُستبدل وحده: المتصفّح بـ`MemoryRouter`، والخادم بـ`fake-api`، والمقبس
 * يغيب (الصفحات تعمل بلا اتصالٍ حيّ كما تعمل حين ينقطع). وما عدا ذلك كما في
 * `Providers`: عميل الاستعلامات، وجلب المستخدم عند الفتح، والإشعارات.
 */
import { expect, vi } from "vitest";
import { configure, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { applySiteTexts } from "../i18n/i18n";
import { EMPTY_SITE_TEXTS } from "../i18n/site-texts";
import { AppRouter } from "../routes";
import { Toaster } from "../components/ui/toaster";
import { AuthBootstrap } from "../app/auth-bootstrap";
import { SocketContext } from "../app/socket-context";
import { useRealtimeSync } from "../hooks/use-realtime-sync";
import { useMessageAlerts } from "../features/messages/hooks/use-message-alerts";
import type { AppSocket } from "../lib/socket/socket";
import { FakeSocket } from "./fake-socket";
import { useAuthStore } from "../store/auth.store";
import type { AuthUser } from "../types/auth";
import { authUsers } from "./fixtures";
import { fake, installFakeApi } from "./fake-api";

export type Who = "admin" | "professor" | "student" | null;

/**
 * الواجهة كلّها تُرسم ويُكتب فيها حرفاً حرفاً: الاختبار أبطأ من اختبار وحدة،
 * وأبطأ بكثير حين تجري الملفّات كلّها معاً تحت التغطية. فمهلةٌ أطول لملفّات
 * هذا المساعد وحدها.
 */
vi.setConfig({ testTimeout: 40_000 });
// وما يُنتظر (`findBy…`، `waitFor`) يمرّ بمؤجِّلات البحث (٣٠٠ms) ثمّ الطلب:
// ثانيةٌ واحدة تكفي وحده، ولا تكفي والملفّات كلّها تجري معاً.
configure({ asyncUtilTimeout: 8000 });

/** يدخل بحساب الدور كما يحفظه المتجر بعد الدخول — أو يخرج (`null`). */
export function signIn(who: Who, patch: Partial<AuthUser> = {}) {
  if (!who) {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false });
    fake.session = null;
    return;
  }
  const user = { ...authUsers[who], ...patch };
  useAuthStore.setState({ user, accessToken: `tok-${who}`, isAuthenticated: true });
  fake.session = user;
}

/** ما يضعه `Providers` فوق الصفحات: التحديث الحيّ وتنبيه الرسائل. */
function Realtime() {
  useRealtimeSync();
  useMessageAlerts();
  return null;
}

let here = "";
function Where() {
  const l = useLocation();
  here = `${l.pathname}${l.search}`;
  return null;
}

export function renderApp(
  path: string,
  { as = null as Who, user: patch = {} as Partial<AuthUser>, socket = null as FakeSocket | null } = {},
) {
  installFakeApi();
  // عبارات الإدارة تُطبَّق على i18n نفسه (applySiteTexts): ما حفظه اختبارٌ
  // سابق لا يبقى نصّاً للتالي.
  applySiteTexts(EMPTY_SITE_TEXTS);
  signIn(as, patch);
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  // بلا انتظارٍ بين الحروف: الكتابة كما هي، أسرع.
  const user = userEvent.setup({ delay: null });
  const utils = render(
    <QueryClientProvider client={qc}>
      <SocketContext.Provider value={socket as unknown as AppSocket | null}>
        <MemoryRouter initialEntries={[path]}>
          <AuthBootstrap />
          <Realtime />
          <AppRouter />
          <Toaster />
          <Where />
        </MemoryRouter>
      </SocketContext.Provider>
    </QueryClientProvider>,
  );
  return {
    ...utils,
    qc,
    user,
    /** المسار الذي انتهى إليه الموجِّه الآن. */
    location: () => here,
    /** حتى لا يبقى طلبٌ جارٍ — الصفحة بما جاءها كلّه. */
    settle: () => waitFor(() => expect(qc.isFetching() + qc.isMutating()).toBe(0), { timeout: 4000 }),
  };
}
