import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import { useAuthStore } from "../../store/auth.store";

/**
 * رأس اللوحات: قائمة الحساب (من دخل، وعنوان دخوله يُنسخ، وصفحة الحساب،
 * والخروج) تُغلق بالنقر خارجها وبـEscape — والتركيز يعود إلى زرّها.
 * ومراحل المشروع من صفحته في الإدارة: تُضاف وتُعدَّل وتُحذف.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

describe("قائمة الحساب في رأس اللوحة", () => {
  async function openMenu(as: "admin" | "professor" | "student" = "professor") {
    const app = renderApp(`/ar/${as}`, { as });
    const trigger = (await screen.findAllByRole("button", { expanded: false })).find((b) => /كريم|سمير|أمين/.test(b.textContent ?? ""))!;
    await app.user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    return { app, trigger };
  }

  it("عنوان الدخول يُنسخ، ويقول «نُسخ»", async () => {
    const { app } = await openMenu();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await app.user.click(screen.getByRole("button", { name: t("common.copy") }));
    expect(writeText).toHaveBeenCalledWith(F.prof1.universityEmail);
    expect(await screen.findByRole("button", { name: t("common.copied") })).toBeInTheDocument();
  });

  it("Escape يغلقها ويعيد التركيز إلى زرّها، والنقر خارجها يغلقها", async () => {
    const { app, trigger } = await openMenu();
    await app.user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    await app.user.click(trigger);
    await app.user.click(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("«حسابي» يقود إلى صفحة الحساب بدوره، والخروج يُفرغ الجلسة", async () => {
    const { app } = await openMenu("student");
    await app.user.click(screen.getByText(t("admin.account.menu.profile")));
    await waitFor(() => expect(app.location()).toBe("/ar/student/account"));

    const trigger = (await screen.findAllByRole("button", { expanded: false })).find((b) => /أمين/.test(b.textContent ?? ""))!;
    await app.user.click(trigger);
    await app.user.click(screen.getByRole("menuitem", { name: esc(t("common.logout")) }));
    await waitFor(() => expect(fake.find("post", "/auth/logout")).toHaveLength(1));
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
  });
});

describe("مراحل المشروع من الإدارة", () => {
  async function page() {
    const app = renderApp(`/ar/admin/projects/${F.ID.g1}`, { as: "admin" });
    await screen.findAllByText(F.milestones[0]!.title);
    return app;
  }

  it("مرحلةٌ بلا عنوان لا تُحفظ؛ وبعنوانها وموعدها ⇒ تُرسل إلى المشروع", async () => {
    const app = await page();
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.addMilestone")) })[0]!);
    const save = () => screen.getAllByRole("button", { name: esc(t("pro.save")) }).at(-1)!;
    await app.user.click(save());
    expect(await screen.findByText(t("admin.completeStepFirst"))).toBeInTheDocument();
    await app.user.type(screen.getByPlaceholderText(t("admin.milestoneTitlePlaceholder")), "التدقيق اللغويّ");
    const deadline = document.querySelector('input[type="date"], input[type="datetime-local"]') as HTMLInputElement;
    await app.user.type(deadline, deadline.type === "date" ? "2026-12-15" : "2026-12-15T09:00");
    await app.user.click(save());
    await waitFor(() => expect(fake.find("post", `/admin/projects/${F.ID.g1}/milestones`)[0]?.body).toMatchObject({ title: "التدقيق اللغويّ" }));
  });

  it("تعديل مرحلةٍ بحالتها، وحذف أخرى عليها تسليمات بعد تحذيرٍ بعددها", async () => {
    const app = await page();
    const row = screen.getAllByText(F.milestones[1]!.title)[0]!.closest("li, tr, article") as HTMLElement;
    await app.user.click(within(row).getByRole("button", { name: esc(t("admin.edit")) }));
    const title = screen.getByDisplayValue(F.milestones[1]!.title);
    await app.user.type(title, " (محدّثة)");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("pro.save")) }).at(-1)!);
    await waitFor(() => expect(fake.find("patch", `/admin/milestones/${F.milestones[1]!.id}`)[0]?.body).toMatchObject({ title: `${F.milestones[1]!.title} (محدّثة)` }));

    const first = screen.getAllByText(F.milestones[0]!.title)[0]!.closest("li, tr, article") as HTMLElement;
    await app.user.click(within(first).getByRole("button", { name: esc(t("admin.delete")) }));
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("2");
    await app.user.click(within(alert).getAllByRole("button").at(-1)!);
    await waitFor(() => expect(fake.find("delete", `/admin/milestones/${F.milestones[0]!.id}`)).toHaveLength(1));
  });
});

describe("الشريط الجانبيّ في اللوحة", () => {
  async function dashboard() {
    const app = renderApp("/ar/admin", { as: "admin" });
    const aside = await screen.findByRole("complementary", { name: t("dash.adminPanel") });
    // زرّ الطيّ أسفل الشريط: حاله في aria-expanded.
    const toggle = () => within(aside).getAllByRole("button").find((b) => b.hasAttribute("aria-expanded"))!;
    return { app, aside, toggle };
  }

  it("مفتوحٌ افتراضياً؛ الضغط داخله لا يطويه، والضغط خارجه يطويه", async () => {
    const { app, aside, toggle } = await dashboard();
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    await app.user.click(within(aside).getByRole("navigation"));
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    await app.user.click(screen.getByRole("main"));
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveAccessibleName(t("dash.expand"));
    // مطويّاً: الضغط خارجه لا يفعل شيئاً، وزرّه يفتحه.
    await app.user.click(screen.getByRole("main"));
    await app.user.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("Escape يطويه؛ وزرّ القائمة في الرأس يفتحه ويطويه دون أن يُحسب «خارجه»", async () => {
    const { app, toggle } = await dashboard();
    await app.user.keyboard("{Escape}");
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    const menu = screen.getByRole("button", { name: t("common.menu") });
    await app.user.click(menu);
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    await app.user.click(menu);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("اختيار صفحةٍ منه ينتقل إليها ويبقى مفتوحاً", async () => {
    const { app, aside, toggle } = await dashboard();
    await app.user.click(within(aside).getByRole("link", { name: esc(t("admin.messagesTitle")) }));
    await waitFor(() => expect(app.location()).toBe("/ar/admin/messages"));
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("أضيق من 1024px (جهازٌ لوحيّ) ⇒ يبدأ شريطاً ضيّقاً", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
    try {
      const { toggle } = await dashboard();
      expect(toggle()).toHaveAttribute("aria-expanded", "false");
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    }
  });
});
