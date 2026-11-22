import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../../i18n/i18n";
import { fake } from "../../../../../test/fake-api";
import { renderApp } from "../../../../../test/render-app";
import * as F from "../../../../../test/fixtures";

/**
 * أنواع المواضيع من صفحة المواضيع، وقائمة العناوين بلغتها وأعمدتها.
 *
 * يُحرس: أنّ أنواع القسم تُعرض برموزها وعدد مواضيعها؛ وأنّ نوعاً جديداً لا
 * يُرسل برمزٍ غير صالح أو مأخوذ، ويُرسل بلونه حين يصحّ؛ وأنّ نوعاً عليه
 * مواضيع لا يُحذف ويقول لماذا، وغيره يُحذف بعد تأكيد؛ وأنّ القائمة تُطبع
 * بلغةٍ أخرى وتنبّه إلى ما ليس له اسمٌ لاتيني، وأنّ عموداً يُخفى.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const [ai, iot] = F.topicTypes as [(typeof F.topicTypes)[number], (typeof F.topicTypes)[number]];

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function openTypes() {
  const app = renderApp("/ar/admin/topics", { as: "admin" });
  await screen.findAllByText(F.topicOpen.title);
  await app.user.click(screen.getByTestId("open-topic-types"));
  const dialog = await screen.findByRole("dialog", { name: t("topicTypes.title") });
  await within(dialog).findByTestId("topic-types-list");
  return { app, dialog };
}

describe("أنواع المواضيع", () => {
  it("أنواع القسم برموزها وعدد مواضيعها", async () => {
    const { dialog } = await openTypes();
    expect(fake.find("get", "/admin/topic-types").at(-1)!.query.departmentId).toBe(F.department.id);
    const rows = within(dialog).getAllByTestId("topic-type-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(ai.code);
    expect(rows[0]).toHaveTextContent(ai.name);
    expect(rows[0]).toHaveTextContent(t("topicTypes.count", { count: 2 }));
  });

  it("نوعٌ جديد: رمزٌ غير صالح أو مأخوذ يُقال ولا يُرسل؛ والصالح يُرسل بلونه", async () => {
    const { app, dialog } = await openTypes();
    const box = within(dialog).getByTestId("topic-type-new");
    const add = within(box).getByRole("button", { name: t("topicTypes.addBtn") });
    await app.user.type(within(box).getByRole("textbox", { name: t("topicTypes.name") }), "الأمن السيبراني");
    const code = within(box).getByRole("textbox", { name: t("topicTypes.code") });

    await app.user.type(code, "9X");
    expect(within(box).getByText(t("topicTypes.codeRule"))).toBeInTheDocument();
    expect(add).toBeDisabled();

    await app.user.clear(code);
    await app.user.type(code, "ai");
    expect(within(box).getByText(t("topicTypes.codeTaken"))).toBeInTheDocument();
    expect(add).toBeDisabled();

    await app.user.clear(code);
    await app.user.type(code, "CS");
    await app.user.click(within(box).getByRole("radio", { name: "#fce7f3" }));
    // The preview: the first code it will print.
    expect(within(box).getByTestId("topic-type-badge")).toHaveTextContent("CS01");
    expect(add).toBeEnabled();
    await app.user.click(add);
    await waitFor(() => expect(fake.find("post", "/admin/topic-types")).toHaveLength(1));
    expect(fake.find("post", "/admin/topic-types")[0]!.body).toEqual({
      departmentId: F.department.id,
      name: "الأمن السيبراني",
      code: "CS",
      color: "#fce7f3",
    });
  });

  it("نوعٌ عليه مواضيع لا يُحذف ويقول لماذا؛ وغيره يُحذف بعد تأكيد", async () => {
    const { app, dialog } = await openTypes();
    const [used, free] = within(dialog).getAllByTestId("topic-type-row") as [HTMLElement, HTMLElement];
    const del = within(used).getByRole("button", { name: t("topicTypes.delete") });
    expect(del).toBeDisabled();
    expect(del).toHaveAttribute("title", t("topicTypes.inUse", { count: ai.topicsCount }));

    await app.user.click(within(free).getByRole("button", { name: t("topicTypes.delete") }));
    expect(fake.find("delete", `/admin/topic-types/${iot.id}`)).toEqual([]);
    await app.user.click(within(free).getByRole("button", { name: t("topicTypes.confirmDelete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/topic-types/${iot.id}`)).toHaveLength(1));
  });

  it("يُعدَّل اسمه ورمزه ولونه", async () => {
    const { app, dialog } = await openTypes();
    const row = within(dialog).getAllByTestId("topic-type-row")[1]!;
    await app.user.click(within(row).getByRole("button", { name: t("topicTypes.edit") }));
    const editor = within(dialog).getByTestId("topic-type-editor");
    const name = within(editor).getByRole("textbox", { name: t("topicTypes.name") });
    await app.user.clear(name);
    await app.user.type(name, "إنترنت الأشياء والأنظمة المدمجة");
    await app.user.click(within(editor).getByRole("button", { name: t("topicTypes.save") }));
    await waitFor(() => expect(fake.find("patch", `/admin/topic-types/${iot.id}`)).toHaveLength(1));
    expect(fake.find("patch", `/admin/topic-types/${iot.id}`)[0]!.body).toEqual({
      name: "إنترنت الأشياء والأنظمة المدمجة",
      code: iot.code,
      color: iot.color,
    });
  });
});

describe("قائمة العناوين: لغتها وأعمدتها", () => {
  it("بالفرنسية تنبّه إلى ما ليس له اسمٌ لاتيني؛ وعمودٌ يُخفى", async () => {
    const app = renderApp("/ar/admin/topics", { as: "admin" });
    await screen.findAllByText(F.topicOpen.title);
    await app.user.click(screen.getByTestId("open-titles-list"));
    const dialog = await screen.findByRole("dialog", { name: t("admin.titlesList.title") });
    expect(await within(dialog).findByTestId("titles-sheet")).toHaveAttribute("lang", "ar");
    // The header is bilingual on every sheet: a place without a Latin name is said already.
    expect(within(dialog).getByTestId("titles-latin-gaps")).toHaveTextContent(F.faculty.name);

    await app.user.click(within(dialog).getByTestId("titles-lang-fr"));
    expect(within(dialog).getByTestId("titles-sheet")).toHaveAttribute("lang", "fr");
    expect(within(dialog).getAllByText("République Algérienne Démocratique et Populaire").length).toBeGreaterThan(0);

    // The department's columns by default; the email is there to add, and to take away again.
    const email = within(dialog).getByTestId("titles-col-email");
    expect(email).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByTestId("titles-sheet").querySelector(".tl-mail")).toBeNull();
    await app.user.click(email);
    expect(email).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getAllByRole("columnheader").some((th) => th.textContent === "E-mail de l'encadrant")).toBe(true);
    await app.user.click(email);
    expect(within(dialog).getByTestId("titles-sheet").querySelector(".tl-mail")).toBeNull();
    // Landscape only: no switch for the paper's way.
    expect(within(dialog).queryByRole("group", { name: /orientation|اتجاه/i })).toBeNull();
  });
});
