import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp, signIn } from "../../test/render-app";
import { useAuthStore } from "../../store/auth.store";
import { SESSION_EXPIRED_EVENT } from "../../lib/api/client";
import { SessionExpiredModal } from "./session-expired-modal";
import { SessionGuard } from "./session-guard";

/**
 * انتهاء الجلسة: حين يرفض الخادم تجديدها، أو تُسحب من جهازٍ آخر، أو يطول
 * الخمول نصف ساعة — تُفرغ الجلسة في الحال، وتقول النافذة السبب، وتنقل إلى
 * الدخول بزرّها أو وحدها بعد خمس عشرة ثانية.
 *
 * يُحرس: أنّ انقطاع الشبكة (5xx) لا يُنهي جلسةً قد تكون سليمة؛ وأنّ النافذة
 * لا تتكرّر بتكرّر الحدث.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

afterEach(() => {
  vi.useRealTimers();
  fake.reset();
});

describe("انتهاء الجلسة في اللوحة", () => {
  it("الخادم يرفض التجديد ⇒ الجلسة تُفرغ، والنافذة تقول ذلك، و«الدخول من جديد» إلى صفحته", async () => {
    const app = renderApp("/ar/student", { as: "student" });
    await screen.findByRole("button", { name: /أمين/ });
    fake.fail("post", "/auth/refresh", 401, "انتهت");
    fake.fail("get", "/student/dashboard", 401, "رمزٌ منتهٍ");
    app.qc.invalidateQueries();

    expect(await screen.findByText(t("session.titleToken"))).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    // الحدث نفسه مرّةً أخرى لا يفتح نافذةً ثانية.
    act(() => void window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    expect(screen.getAllByText(t("session.titleToken"))).toHaveLength(1);

    await app.user.click(screen.getByRole("button", { name: new RegExp(t("session.loginAgain")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/login"));
  });

  it("خطأٌ في الخادم (5xx) عند التجديد لا يُنهي الجلسة", async () => {
    const app = renderApp("/ar/student", { as: "student" });
    await screen.findByRole("button", { name: /أمين/ });
    fake.fail("post", "/auth/refresh", 503, "الخادم مشغول");
    fake.fail("get", "/student/dashboard", 401, "رمزٌ منتهٍ");
    app.qc.invalidateQueries();
    await waitFor(() => expect(fake.find("post", "/auth/refresh").length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText(t("session.titleToken"))).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("جلسةٌ سُحبت من جهازٍ آخر ⇒ عنوانها هي", async () => {
    renderApp("/ar/professor", { as: "professor" });
    await screen.findByRole("button", { name: /كريم/ });
    act(() => void window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: "revoked" })));
    expect(await screen.findByText(t("session.titleRevoked"))).toBeInTheDocument();
  });
});

describe("الخمول والعدّ التنازليّ", () => {
  it("نصف ساعةٍ بلا حركة ⇒ «انتهت لخمولك»؛ والحركة تُعيد العدّ", () => {
    vi.useFakeTimers();
    fake.reset();
    signIn("student");
    render(
      <MemoryRouter initialEntries={["/ar/student"]}>
        <SessionGuard>
          <p>اللوحة</p>
        </SessionGuard>
      </MemoryRouter>,
    );
    act(() => vi.advanceTimersByTime(29 * 60_000));
    act(() => void window.dispatchEvent(new Event("mousemove")));
    act(() => vi.advanceTimersByTime(29 * 60_000));
    expect(screen.queryByText(t("session.titleIdle"))).toBeNull();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText(t("session.titleIdle"))).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("النافذة تعدّ تنازلياً ثمّ تنقل وحدها؛ ومغلقةً لا تعدّ", async () => {
    vi.useFakeTimers();
    const onLogin = vi.fn();
    const { rerender } = render(<SessionExpiredModal open={false} reason="token" onLogin={onLogin} autoRedirectSeconds={3} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(onLogin).not.toHaveBeenCalled();

    rerender(<SessionExpiredModal open reason="token" onLogin={onLogin} autoRedirectSeconds={3} />);
    expect(screen.getByText(t("session.redirectIn", { n: 3 }))).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText(t("session.redirectIn", { n: 2 }))).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(onLogin).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(onLogin).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    // وزرّها ينقل في الحال.
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole("button", { name: new RegExp(t("session.loginAgain")) }));
    expect(onLogin).toHaveBeenCalledTimes(2);
  });
});

describe("بعد انتهاء الجلسة يدخل حسابٌ آخر", () => {
  it("جلسة مسؤولٍ انتهت على صفحةٍ للإدارة، ثمّ دخل أستاذ ⇒ إلى لوحته، لا «غير مصرّح»", async () => {
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await screen.findAllByText(/./);
    act(() => void window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: "revoked" })));
    await app.user.click(await screen.findByRole("button", { name: new RegExp(t("session.loginAgain")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/login"));

    act(() => signIn("professor"));
    await waitFor(() => expect(app.location()).toBe("/ar/professor"));
  });

  it("ومن عاد بحسابه نفسه يرجع إلى الصفحة التي كان فيها", async () => {
    const app = renderApp("/ar/admin/students", { as: "admin" });
    await screen.findAllByText(/./);
    act(() => void window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: "revoked" })));
    await app.user.click(await screen.findByRole("button", { name: new RegExp(t("session.loginAgain")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/login"));

    act(() => signIn("admin"));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/students"));
  });
});
