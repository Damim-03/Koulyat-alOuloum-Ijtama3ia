import { beforeEach, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import i18n from "../i18n/i18n";
import { fake } from "../test/fake-api";
import { renderApp } from "../test/render-app";
import * as F from "../test/fixtures";
import { useAuthStore } from "../store/auth.store";
import type { AuthUser } from "../types/auth";

/**
 * حسابٌ آخر في التبويب نفسه لا يرث شيئاً من الأوّل.
 *
 * ما يحفظه عميل الاستعلامات يعيش ما عاش التبويب: من خرج ودخل غيرُه بعده
 * كان الثاني يرى ملفّ الأوّل المحفوظ — فلا اسم له في الرأس، رقمُ تسجيله
 * وحده — وقد يرى طلباته حتى يصل جلبُ الصفحة.
 *
 * يُحرس: أنّ دخول حسابٍ آخر يُعيد الجلب باسمه هو ويُسقط ما كان للأوّل؛
 * وأنّ العائد بحسابه نفسه يجد ما تركه بلا جلبٍ زائد.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

/** As the student sign-in answers: no name — that comes from /auth/me. */
const other: AuthUser = { id: "stu-other", role: "student", registrationNumber: "202100000999", mustChangePassword: false };
const otherOnServer = { ...other, firstName: "عبد القادر", lastName: "سعيدي", gender: "male" as const };

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

function switchTo(user: AuthUser, server: object) {
  fake.session = server as AuthUser;
  act(() => useAuthStore.getState().login(user, { accessToken: `tok-${user.id}` } as never));
}

describe("حسابٌ آخر في التبويب نفسه", () => {
  it("يُجلب ملفّه هو: اسمه في الرأس، لا رقمُ تسجيله", async () => {
    renderApp("/ar/student/requests", { as: "student" });
    await waitFor(() => expect(within(document.querySelector<HTMLElement>("header.sticky")!).getAllByText("أمين حداد").length).toBeGreaterThan(0));
    const fetched = fake.find("get", "/auth/me").length;

    switchTo(other, otherOnServer);

    await waitFor(() => expect(useAuthStore.getState().user?.firstName).toBe("عبد القادر"));
    expect(fake.find("get", "/auth/me").length).toBeGreaterThan(fetched);
    const header = document.querySelector<HTMLElement>("header.sticky")!;
    await waitFor(() => expect(within(header).getAllByText("عبد القادر سعيدي").length).toBeGreaterThan(0));
    expect(within(header).queryAllByText("أمين حداد")).toHaveLength(0);
  });

  it("وما كان للأوّل على الصفحة يزول: طلباته لا تُعرض للثاني", async () => {
    renderApp("/ar/student/requests", { as: "student" });
    await screen.findAllByText(F.topicApproved.title);

    fake.on("get", "/student/group-requests", { requests: [] });
    fake.on("get", "/student/my-project", { project: null });
    switchTo(other, otherOnServer);

    await waitFor(() => expect(screen.queryByText(F.topicApproved.title)).toBeNull());
    expect(await screen.findByText(t("stu.req.emptyBody"))).toBeInTheDocument();
  });

  it("بعد خروجٍ: من يعود بحسابه نفسه يجد ما تركه، بلا جلبٍ للملفّ من جديد", async () => {
    const app = renderApp("/ar/student/requests", { as: "student" });
    await screen.findAllByText(F.topicApproved.title);
    await app.settle();
    const fetched = fake.find("get", "/auth/me").length;

    act(() => useAuthStore.getState().logout());
    switchTo(F.authUsers.student, F.authUsers.student);
    await app.settle();

    expect(fake.find("get", "/auth/me")).toHaveLength(fetched);
    expect(app.qc.getQueryData<{ user: AuthUser }>(["auth", "me"])?.user.id).toBe(F.authUsers.student.id);
  });
});
