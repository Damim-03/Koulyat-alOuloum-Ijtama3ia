import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import { useAuthStore } from "../../store/auth.store";

/**
 * واجهة الزائر: شريط التنقّل (قائمة المستخدم، والخروج، وقائمة الهاتف،
 * واللغة)، وشريط الأخبار وقائمته الكاملة.
 *
 * يُحرس: أنّ «لوحتي» تقود إلى لوحة الدور، وأنّ الخروج يُبلغ الخادم ويُفرغ
 * الجلسة؛ وأنّ تبديل اللغة يبقي الصفحة نفسها؛ وأنّ الأخبار المنشورة وحدها
 * في قائمتها.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("شريط التنقّل", () => {
  it("قائمة المستخدم: «لوحتي» تقود إلى لوحة دوره", async () => {
    const app = renderApp("/ar", { as: "student" });
    await app.user.click((await screen.findAllByRole("button", { name: /أمين/ }))[0]!);
    await app.user.click((await screen.findAllByRole("link", { name: esc(t("common.dashboard")) }))[0]!);
    await waitFor(() => expect(app.location()).toBe("/ar/student"));
  });

  it("الخروج من القائمة يُبلغ الخادم ويُفرغ الجلسة", async () => {
    const app = renderApp("/ar/about", { as: "professor" });
    await app.user.click((await screen.findAllByRole("button", { name: /كريم/ }))[0]!);
    await app.user.click((await screen.findAllByRole("button", { name: esc(t("common.logout")) }))[0]!);
    await waitFor(() => expect(fake.find("post", "/auth/logout")).toHaveLength(1));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("قائمة الهاتف: تُفتح، وروابطها تقود وتُغلقها", async () => {
    const app = renderApp("/ar", {});
    await app.user.click(await screen.findByRole("button", { name: t("common.menu") }));
    const links = screen.getAllByRole("link", { name: esc(t("common.about")) });
    await app.user.click(links.at(-1)!);
    await waitFor(() => expect(app.location()).toBe("/ar/about"));
  });

  it("تبديل اللغة يبقي الصفحة نفسها", async () => {
    const app = renderApp("/ar/about", {});
    await screen.findAllByText(F.about.ar.intro[0]!);
    const switcher = screen.getAllByRole("button").find((b) => /^(AR|FR|EN)$/.test(b.textContent?.trim() ?? "") || b.getAttribute("aria-haspopup"));
    await app.user.click(switcher!);
    await app.user.click((await screen.findAllByText(/Français|FR/)).at(-1)!);
    await waitFor(() => expect(app.location()).toBe("/fr/about"));
  });
});

describe("الأخبار", () => {
  it("«كلّ الأخبار» تفتح قائمتها، وتُغلق", async () => {
    const app = renderApp("/ar", {});
    // أثناء التحميل يُحجز مكان الشريط بزرٍّ مطفأ؛ ثمّ يأتي الحقيقيّ.
    const viewAll = () => screen.getByRole("button", { name: esc(t("news.viewAll")) });
    await waitFor(() => expect(viewAll()).toBeEnabled());
    await app.user.click(viewAll());
    const dialog = await screen.findByRole("dialog", { name: t("news.allTitle") });
    expect(within(dialog).getByText(F.news[0]!.text)).toBeInTheDocument();
    await app.user.click(within(dialog).getByRole("button", { name: t("news.close") }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: t("news.allTitle") })).toBeNull());
  });

  it("بلا أخبار ⇒ لا شريط", async () => {
    fake.empty = true;
    renderApp("/ar", {});
    await waitFor(() => expect(fake.find("get", "/site/news")).toHaveLength(1));
    expect(screen.queryByRole("button", { name: esc(t("news.viewAll")) })).toBeNull();
  });
});

describe("شريط التنقّل: التنبيه بعد الدخول وقائمة الهاتف", () => {
  beforeEach(() => sessionStorage.clear());

  it("بعد الدخول يُنبَّه إلى اللوحة مرّةً في الجلسة؛ «لاحقاً» يُخفيه ولا يعود", async () => {
    const app = renderApp("/ar", { as: "student" });
    expect(await screen.findByText(t("spotlight.title"))).toBeInTheDocument();
    expect(sessionStorage.getItem("dash_spotlight")).toBe("1");
    await app.user.click(screen.getByRole("button", { name: t("spotlight.later") }));
    await waitFor(() => expect(screen.queryByText(t("spotlight.title"))).toBeNull());
    app.unmount();

    renderApp("/ar", { as: "student" });
    await screen.findAllByRole("button", { name: /أمين/ });
    await new Promise((r) => setTimeout(r, 1300));
    expect(screen.queryByText(t("spotlight.title"))).toBeNull();
  });

  it("و«إلى لوحتي» في التنبيه يقود إليها", async () => {
    const app = renderApp("/ar/about", { as: "professor" });
    await app.user.click(await screen.findByRole("link", { name: esc(t("spotlight.go")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/professor"));
  });

  it("قائمة المستخدم تُغلق بالنقر خارجها", async () => {
    const app = renderApp("/ar", { as: "student" });
    const trigger = (await screen.findAllByRole("button", { name: /أمين/ }))[0]!;
    await app.user.click(trigger);
    expect(await screen.findAllByRole("link", { name: esc(t("common.dashboard")) })).not.toHaveLength(0);
    await app.user.click(document.body);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("قائمة الهاتف لمن دخل: «لوحتي» تقود، والخروج يُفرغ الجلسة؛ والرئيسية والمواضيع تُغلقها", async () => {
    sessionStorage.setItem("dash_spotlight", "1");
    const app = renderApp("/ar/about", { as: "student" });
    const menu = await screen.findByRole("button", { name: t("common.menu") });
    await app.user.click(menu);
    await app.user.click(screen.getAllByRole("link", { name: esc(t("common.topics")) }).at(-1)!);
    await waitFor(() => expect(app.location()).toBe("/ar/topics"));
    await app.user.click(menu);
    await app.user.click(screen.getAllByRole("link", { name: esc(t("common.home")) }).at(-1)!);
    await waitFor(() => expect(app.location()).toBe("/ar"));
    await app.user.click(menu);
    await app.user.click(screen.getAllByRole("link", { name: esc(t("common.dashboard")) }).at(-1)!);
    await waitFor(() => expect(app.location()).toBe("/ar/student"));
  });

  it("والخروج من قائمة الهاتف", async () => {
    sessionStorage.setItem("dash_spotlight", "1");
    const app = renderApp("/ar/about", { as: "student" });
    await app.user.click(await screen.findByRole("button", { name: t("common.menu") }));
    await app.user.click(screen.getAllByRole("button", { name: esc(t("common.logout")) }).at(-1)!);
    await waitFor(() => expect(fake.find("post", "/auth/logout")).toHaveLength(1));
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
  });
});
