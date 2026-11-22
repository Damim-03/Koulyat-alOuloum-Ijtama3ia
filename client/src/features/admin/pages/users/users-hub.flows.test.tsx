import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * «المستخدمون» ومعها تفعيل الحسابات وسجلّ العمليات: مفتاحٌ واحد بأربعة أجزاء.
 *
 * يُحرس: أنّ المستخدمين ما يُفتح أوّلاً، وعدد الطلبات المنتظرة على المفتاح؛
 * وأنّ كلّ جزءٍ يسكن الرابط ويُفتح من هناك؛ وأنّ روابط صفحتي التفعيل والسجلّ القديمتين —
 * إشعاراتٌ أُرسلت، وعلاماتٌ حُفظت — تصل إلى مكانها هنا بما حملته؛ وأنّ القائمة
 * الجانبية لا تعرضهما صفحتين وحدهما.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("المستخدمون وتفعيل حساباتهم", () => {
  it("المستخدمون أوّلاً، وعدد ما ينتظر على «طلبات التوثيق»؛ وكلّ جزءٍ يسكن الرابط", async () => {
    const app = renderApp("/ar/admin/users", { as: "admin" });
    expect(await screen.findByRole("heading", { name: t("admin.usersTitle") })).toBeInTheDocument();
    expect(screen.getByTestId("users-view-users")).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByTestId("users-view-requests")).toHaveTextContent("1"));

    await app.user.click(screen.getByTestId("users-view-requests"));
    expect(await screen.findByTestId("activation-request")).toBeInTheDocument();
    expect(screen.getByTestId("users-view-requests")).toHaveAttribute("aria-selected", "true");
    expect(app.location()).toContain("view=requests");
    expect(screen.queryByRole("heading", { name: t("admin.usersTitle") })).toBeNull();

    await app.user.click(screen.getByTestId("users-view-desk"));
    expect(await screen.findByTestId("desk-input")).toBeInTheDocument();
    expect(app.location()).toContain("view=desk");

    await app.user.click(screen.getByTestId("users-view-audit"));
    expect(await screen.findByTestId("audit-log-page")).toBeInTheDocument();
    expect(app.location()).toContain("view=audit");

    await app.user.click(screen.getByTestId("users-view-users"));
    expect(await screen.findByRole("heading", { name: t("admin.usersTitle") })).toBeInTheDocument();
    expect(app.location()).not.toContain("view=");
  });

  it("رابط سجلّ العمليات القديم — تنبيه محاولات الدخول الفاشلة — ⇒ السجلّ هنا، بفلتره", async () => {
    const app = renderApp("/ar/admin/audit-log?kind=failed", { as: "admin" });
    expect(await screen.findByTestId("audit-log-page")).toBeInTheDocument();
    expect(screen.getByTestId("users-view-audit")).toHaveAttribute("aria-selected", "true");
    expect(app.location()).toContain("view=audit");
    expect(app.location()).toContain("kind=failed");
  });

  it("رابط صفحة التفعيل القديم ⇒ طلبات التوثيق هنا", async () => {
    const app = renderApp("/ar/admin/activation", { as: "admin" });
    expect(await screen.findByTestId("activation-request")).toBeInTheDocument();
    await waitFor(() => expect(app.location()).toBe("/ar/admin/users?view=requests"));
  });

  it("ورابط مكتبها بطالبٍ مفتوح ⇒ المكتب هنا، والطالب نفسه مفتوح", async () => {
    const app = renderApp(`/ar/admin/activation?tab=students&student=${F.deskStudent.id}`, { as: "admin" });
    expect(await screen.findByTestId("student-profile")).toBeInTheDocument();
    expect(app.location()).toContain("view=desk");
    expect(app.location()).toContain(`student=${F.deskStudent.id}`);
    expect(app.location()).not.toContain("tab=");
  });

  it("القائمة الجانبية: «المستخدمون» — ولا صفحة تفعيلٍ ولا سجلّ وحدهما", async () => {
    renderApp("/ar/admin/users", { as: "admin" });
    await screen.findByTestId("users-switch");
    const nav = screen.getAllByRole("navigation")[0]!;
    expect(within(nav).queryByRole("link", { name: new RegExp(t("admin.activation.nav")) })).toBeNull();
    expect(within(nav).getAllByRole("link").some((a) => a.getAttribute("href")?.includes("audit-log"))).toBe(false);
    expect(within(nav).getAllByRole("link").some((a) => a.getAttribute("href") === "/ar/admin/users")).toBe(true);
  });
});
