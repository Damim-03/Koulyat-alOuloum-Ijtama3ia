import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * صفحة التخصّص: طلبته (بحثٌ بالاسم وبالرقم، وبالسنة، ومن لا مشروع له)،
 * ومواضيعه، ونافذة معاينةٍ لكلّ طالب تقود إلى صفحته.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const studentsQuery = () => fake.find("get", "/admin/students").at(-1)!.query;

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function open() {
  const app = renderApp(`/ar/admin/specializations/${F.ID.spec1}`, { as: "admin" });
  await app.user.click(await screen.findByTestId("spec-tab-students"));
  await screen.findByTestId("spec-student-search");
  return app;
}

describe("طلبة التخصّص", () => {
  it("كلّ فلترٍ يصل الخادم مع التخصّص", async () => {
    const app = await open();
    await waitFor(() => expect(studentsQuery()).toMatchObject({ specializationId: F.ID.spec1 }));
    await app.user.type(screen.getByTestId("spec-student-search"), "سارة");
    await waitFor(() => expect(studentsQuery()).toMatchObject({ search: "سارة" }));
    await app.user.type(screen.getByPlaceholderText(t("admin.searchByRegNumberPlaceholder")), "2020390");
    await waitFor(() => expect(Object.values(studentsQuery())).toContain("2020390"));
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.struct.spec.unassigned")) }));
    await waitFor(() => expect(studentsQuery()).toMatchObject({ unassigned: "true" }));
  });

  it("صفّ طالبٍ يفتح معاينته، ومنها صفحته", async () => {
    const app = await open();
    const row = (await screen.findAllByText(F.student2.registrationNumber))[0]!.closest("tr")!;
    await app.user.click(row);
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    expect(within(dialog).getAllByText(F.studentUsers[1]!.email!).length).toBeGreaterThan(0);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.openStudentDetails")) }));
    await waitFor(() => expect(app.location()).toBe(`/ar/admin/students/${F.student2.id}`));
  });

  it("المعاينة تُغلق بزرّها", async () => {
    const app = await open();
    await app.user.click((await screen.findAllByText(F.student2.registrationNumber))[0]!.closest("tr")!);
    const dialog = (await screen.findAllByRole("dialog")).at(-1)!;
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.closeWindow")) }));
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  });
});

describe("مواضيع التخصّص والتخصّص نفسه", () => {
  it("تبويب المواضيع يعرض مواضيعه", async () => {
    const app = renderApp(`/ar/admin/specializations/${F.ID.spec1}`, { as: "admin" });
    await app.user.click(await screen.findByTestId("spec-tab-topics"));
    expect((await screen.findAllByText(F.topicOpen.title)).length).toBeGreaterThan(0);
  });

  it("تخصّصٌ بلا طلبةٍ ولا مواضيع يُحذف، ويعود إلى شعبته", async () => {
    fake.on("get", "/admin/specializations", { specializations: [{ ...F.specialization, _count: { students: 0, topics: 0 } }, F.specialization2] });
    const app = renderApp(`/ar/admin/specializations/${F.ID.spec1}`, { as: "admin" });
    await app.user.click(await screen.findByRole("button", { name: esc(t("admin.delete")) }));
    await app.user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: t("admin.delete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/specializations/${F.ID.spec1}`)).toHaveLength(1));
    await waitFor(() => expect(app.location()).toContain(`/filieres/${F.filiere.id}`));
  });
});
