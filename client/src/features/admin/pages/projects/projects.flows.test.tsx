import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * المشروع بعد قيامه: أعضاؤه ومرسِلُه، ومشرفه، ومناقشته بلجنتها، وفسخه.
 *
 * يُحرس: أنّ تعديل الأعضاء يُرسل الفريق كلّه بمرسِله؛ وأنّ المناقشة لا تُحفظ
 * بلا تاريخٍ وقاعة، ولا فوق مناقشةٍ أخرى في القاعة نفسها إلّا بإقرار؛ وأنّ
 * الفسخ يقول ما يمنعه قبل أن يُطلب.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function projectPage(id: string = F.ID.g1) {
  const app = renderApp(`/ar/admin/projects/${id}`, { as: "admin" });
  await screen.findAllByText(id === F.ID.g1 ? F.topicFull.title : F.project2.topic.title);
  return app;
}

describe("الأعضاء", () => {
  it("إضافة طالبٍ بالبحث ⇒ يُحفظ الفريق كلّه بمرسِله", async () => {
    const app = await projectPage();
    await app.user.click(screen.getByTestId("project-members-action"));
    const dialog = await screen.findByRole("dialog");
    await app.user.type(within(dialog).getByPlaceholderText(t("admin.searchStudentAny")), "سارة");
    await app.user.click(await within(dialog).findByText(/سارة/));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.saveMembers")) }));
    await waitFor(() => expect(fake.find("patch", "/admin/topics/t-full/assignment")).toHaveLength(1));
    expect(fake.find("patch", "/admin/topics/t-full/assignment")[0]!.body).toEqual({
      memberStudentIds: [F.student1.id, F.student4.id, F.student2.id],
      leaderStudentId: F.student1.id,
    });
  });

  it("بلا أعضاء ⇒ «عضوٌ واحدٌ على الأقل»، ولا حفظ", async () => {
    const app = await projectPage();
    await app.user.click(screen.getByTestId("project-members-action"));
    const dialog = await screen.findByRole("dialog");
    for (const b of within(dialog).getAllByRole("button", { name: t("admin.removeCover") })) await app.user.click(b);
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.saveMembers")) }));
    expect(within(dialog).getAllByText(t("admin.needOneMember")).length).toBeGreaterThan(0);
    expect(fake.find("patch", /\/assignment$/)).toEqual([]);
  });

  it("من الجدول: جعلُ عضوٍ مرسِلاً، وإخراجُ آخر بعد التأكيد", async () => {
    const app = await projectPage();
    await app.user.click(screen.getByRole("button", { name: t("admin.setAsLeader") }));
    await waitFor(() => expect(fake.find("patch", `/admin/projects/${F.ID.g1}/leader/${F.student4.id}`)).toHaveLength(1));

    await app.user.click(screen.getAllByRole("button", { name: t("admin.proj.removeMember") })[0]!);
    const confirm = await screen.findAllByRole("button", { name: esc(t("admin.proj.removeMember")) });
    await app.user.click(confirm.at(-1)!);
    await waitFor(() => expect(fake.find("delete", new RegExp(`^/admin/projects/${F.ID.g1}/members/`))).toHaveLength(1));
  });
});

describe("المشرف", () => {
  it("مشرفٌ آخر ⇒ يُرسل معرّفه", async () => {
    const app = await projectPage();
    await app.user.click(screen.getByTestId("project-supervisor-action"));
    const dialog = await screen.findByRole("dialog");
    const trigger = within(dialog).getAllByRole("button").find((b) => b.getAttribute("aria-haspopup") === "listbox")!;
    await app.user.click(trigger);
    await app.user.click(await screen.findByRole("option", { name: /نادية/ }));
    await app.user.click(within(dialog).getByTestId("supervisor-save"));
    await waitFor(() => expect(fake.find("patch", `/admin/projects/${F.ID.g1}/supervisor`)[0]?.body).toEqual({ professorId: F.prof2.id }));
  });
});

describe("المناقشة", () => {
  async function openEdit(app: ReturnType<typeof renderApp>) {
    await app.user.click(screen.getAllByRole("button", { name: t("admin.proj.editDefense") })[0]!);
    return screen.findByRole("dialog");
  }

  it("تعديل القاعة ⇒ يُحفظ بلجنتها كما هي", async () => {
    const app = await projectPage();
    const dialog = await openEdit(app);
    const room = within(dialog).getByTestId("defense-room");
    expect(room).toHaveValue(F.defense.room);
    await app.user.clear(room);
    await app.user.type(room, "مدرّج ب");
    await app.user.click(within(dialog).getByTestId("defense-save"));
    await waitFor(() => expect(fake.find("patch", "/admin/defenses/df1")).toHaveLength(1));
    expect(fake.find("patch", "/admin/defenses/df1")[0]!.body).toMatchObject({
      room: "مدرّج ب",
      durationMinutes: 60,
      status: "scheduled",
      committee: [
        { professorId: F.prof2.id, role: "president" },
        { professorId: F.prof1.id, role: "supervisor" },
        { professorId: F.prof3.id, role: "examiner" },
      ],
    });
  });

  it("بلا قاعة ولا علامةٍ في حدودها ⇒ تُقال الأخطاء، ولا حفظ", async () => {
    const app = await projectPage();
    const dialog = await openEdit(app);
    await app.user.clear(within(dialog).getByTestId("defense-room"));
    // العلامة تُطلب حين تُعلَّم المناقشة منتهية.
    await app.user.click(within(dialog).getByRole("radio", { name: esc(t("admin.proj.defenseState.completed")) }));
    await app.user.type(within(dialog).getByTestId("defense-grade"), "25");
    await app.user.click(within(dialog).getByTestId("defense-save"));
    expect(within(dialog).getByText(t("admin.proj.defenseForm.roomRequired"))).toBeInTheDocument();
    expect(within(dialog).getByText(t("admin.proj.defenseForm.gradeRange"))).toBeInTheDocument();
    expect(fake.find("patch", "/admin/defenses/df1")).toEqual([]);
  });

  it("قاعةٌ مشغولة في الوقت نفسه ⇒ تُعرض، ولا حفظ إلّا بإقرار", async () => {
    fake.on("get", "/admin/defenses/conflicts", { room: [{ id: "df9", title: "مناقشةٌ أخرى", date: F.defense.date, room: F.defense.room }], professors: [] });
    const app = await projectPage();
    const dialog = await openEdit(app);
    expect(await within(dialog).findByTestId("defense-clashes")).toHaveTextContent("مناقشةٌ أخرى");
    await app.user.click(within(dialog).getByTestId("defense-save"));
    expect(fake.find("patch", "/admin/defenses/df1")).toEqual([]);
    await app.user.click(within(dialog).getByTestId("defense-clash-ok"));
    await app.user.click(within(dialog).getByTestId("defense-save"));
    await waitFor(() => expect(fake.find("patch", "/admin/defenses/df1")).toHaveLength(1));
  });

  it("حذف المناقشة بعد التأكيد", async () => {
    const app = await projectPage();
    await app.user.click(screen.getAllByRole("button", { name: t("admin.proj.deleteDefense") })[0]!);
    const confirm = await screen.findAllByRole("button", { name: esc(t("admin.delete")) });
    await app.user.click(confirm.at(-1)!);
    await waitFor(() => expect(fake.find("delete", "/admin/defenses/df1")).toHaveLength(1));
  });

  it("برمجةُ مناقشةٍ لمشروعٍ بلا مناقشة — من صفحة المناقشات", async () => {
    const app = renderApp("/ar/admin/defenses", { as: "admin" });
    await app.user.click(await screen.findByTestId("defenses-schedule"));
    const dialog = await screen.findByRole("dialog");
    await app.user.type(within(dialog).getByTestId("defense-project-search"), "التنمّر");
    await app.user.click(await within(dialog).findByText(F.project2.topic.title));
    expect(within(dialog).getByTestId("defense-project")).toHaveTextContent(F.project2.topic.title);

    fireEvent.change(within(dialog).getByTestId("defense-date"), { target: { value: "2026-11-20T09:00" } });
    await app.user.type(within(dialog).getByTestId("defense-room"), "قاعة 4");
    await app.user.click(within(dialog).getByTestId("defense-add-seat"));
    const seat = within(dialog).getAllByRole("button").filter((b) => b.getAttribute("aria-haspopup") === "listbox").at(-1)!;
    await app.user.click(seat);
    await app.user.click(await screen.findByRole("option", { name: /رشيد/ }));
    await app.user.click(within(dialog).getByTestId("defense-save"));

    await waitFor(() => expect(fake.find("post", "/admin/defenses")).toHaveLength(1));
    expect(fake.find("post", "/admin/defenses")[0]!.body).toMatchObject({
      groupId: F.ID.g2,
      room: "قاعة 4",
      date: new Date("2026-11-20T09:00").toISOString(),
      committee: expect.arrayContaining([{ professorId: F.prof3.id, role: "president" }]),
    });
  });
});

describe("الفسخ", () => {
  it("مشروعٌ بتسليماتٍ ومناقشة ⇒ ما يمنعه، ولا زرّ تأكيد", async () => {
    const app = await projectPage();
    await app.user.click(screen.getByTestId("project-dissolve"));
    expect(await screen.findByTestId("dissolve-blocked")).toBeInTheDocument();
    expect(screen.getByTestId("dissolve-confirm")).toBeDisabled();
  });

  it("مشروعٌ بلا ما يمنع ⇒ بسببٍ وإقرار، ثمّ يُفسخ ويُعاد إلى القائمة", async () => {
    const app = await projectPage(F.ID.g2);
    await app.user.click(screen.getByTestId("project-dissolve"));
    expect(screen.getByTestId("dissolve-confirm")).toBeDisabled();
    await app.user.type(screen.getByTestId("dissolve-reason"), "تغيير التخصّص");
    await app.user.click(screen.getByTestId("dissolve-sure"));
    await app.user.click(screen.getByTestId("dissolve-confirm"));
    await waitFor(() => expect(fake.find("delete", `/admin/projects/${F.ID.g2}`)[0]?.body).toEqual({ reason: "تغيير التخصّص" }));
    await waitFor(() => expect(app.location()).toMatch(/^\/ar\/admin\/projects$/));
  });
});

describe("صفحة المشروع: ما حولها", () => {
  it("تعذّر التحميل ⇒ سببه و«إعادة» تطلب من جديد", async () => {
    fake.fail("get", "/admin/projects/:id", 500, "خطأ");
    const app = renderApp(`/ar/admin/projects/${F.ID.g1}`, { as: "admin" });
    expect(await screen.findByText(t("admin.projectLoadFailed"))).toBeInTheDocument();
    const before = fake.find("get", /^\/admin\/projects\/[^/]+$/).length;
    const box = screen.getByText(t("admin.projectLoadFailed")).parentElement!;
    await app.user.click(within(box).getAllByRole("button")[0]!);
    await waitFor(() => expect(fake.find("get", /^\/admin\/projects\/[^/]+$/).length).toBeGreaterThan(before));
  });

  it("نسخ الرابط: نجاحه وفشله يُقالان", async () => {
    const app = await projectPage();
    // بعد إنشاء user-event: هو يضع حافظته الخاصّة عند إعداده.
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.copyLink")) }));
    expect(await screen.findByText(t("admin.proj.linkCopied"))).toBeInTheDocument();
    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.copyLink")) }));
    expect(await screen.findByText(t("admin.proj.linkCopyFailed"))).toBeInTheDocument();
  });

  it("تنبيهٌ بمرحلةٍ متأخّرة ⇒ «اذهب إليه» ينقل إلى مكانه في الصفحة", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const app = await projectPage();
    const alerts = await screen.findByTestId("project-alerts");
    await app.user.click(within(alerts).getAllByRole("button", { name: esc(t("admin.proj.goThere")) })[0]!);
    expect(scroll).toHaveBeenCalled();
  });

  it("مناقشةٌ انتهت بعلامتها ⇒ العلامة وتقديرها", async () => {
    fake.on("get", "/admin/projects/:id", { project: { ...F.project, defense: { ...F.project.defense, status: "completed", grade: 16.5, date: F.days(-3) } } });
    await projectPage();
    expect((await screen.findAllByText(/16[.,]5/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t("admin.proj.defenseState.completed")).length).toBeGreaterThan(0);
  });
});

describe("صفحة المشروع: المناقشة والأعضاء وما يُنسخ", () => {
  const done = F.milestones.map((m) => ({ ...m, status: "completed" }));
  const withProject = (patch: Record<string, unknown>) =>
    fake.on("get", "/admin/projects/:id", { project: { ...F.project, ...patch } });

  it("كلّ شيءٍ على ما يرام ⇒ «لا تنبيهات» بدل قائمتها", async () => {
    // عضوٌ واحد من تخصّص الموضوع في مقعدٍ واحد (الرابع من تخصّصٍ آخر فيُنبَّه عليه).
    withProject({
      topic: { ...F.project.topic, maxStudents: 1 },
      members: [F.project.members[0]],
      milestones: done,
      defense: { ...F.project.defense, status: "completed", grade: 15 },
    });
    await projectPage();
    expect(screen.getByTestId("project-alerts-clear")).toHaveTextContent(t("admin.proj.allClear"));
  });

  it("بلا مناقشةٍ والمراحل كلّها أُنجزت ⇒ «جاهزٌ للمناقشة»، و«برمجة» تفتح نموذجها", async () => {
    withProject({ milestones: done, defense: null });
    const app = await projectPage();
    expect(screen.getByText(t("admin.proj.defenseReadyHint"))).toBeInTheDocument();
    // في البطل وفي بطاقة المناقشة: كلاهما يفتح النموذج نفسه.
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.proj.scheduleDefense")) }).at(-1)!);
    expect(await screen.findByRole("dialog", { name: t("admin.proj.defenseForm.newTitle") })).toBeInTheDocument();
  });

  it("حذف المناقشة من بطاقتها: التراجع لا يحذف، والتأكيد يحذف", async () => {
    const app = await projectPage();
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.deleteDefense") }));
    let alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getByRole("button", { name: t("admin.cancel") }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fake.find("delete", /^\/admin\/defenses\//)).toEqual([]);

    await app.user.click(screen.getByRole("button", { name: t("admin.proj.deleteDefense") }));
    alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getByRole("button", { name: t("admin.confirmDelete") }));
    await waitFor(() => expect(fake.find("delete", `/admin/defenses/${F.defense.id}`)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("«تعديل اللجنة» و«تعديل المناقشة» يفتحان نموذجها عليها، و«إدارة الأعضاء» نافذتها، و«إلى المراحل» يمرّر إليها", async () => {
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    const app = await projectPage();
    // «تعديل المناقشة» في البطل وفي بطاقتها، و«تعديل اللجنة» في بطاقتها.
    const openers = [t("admin.proj.editCommittee"), t("admin.proj.editDefense")].flatMap((n) => screen.getAllByRole("button", { name: n }));
    expect(openers.length).toBeGreaterThanOrEqual(3);
    for (const opener of openers) {
      await app.user.click(opener);
      const dialog = await screen.findByRole("dialog", { name: t("admin.proj.defenseForm.editTitle") });
      expect(within(dialog).getByTestId("defense-room")).toHaveValue(F.defense.room);
      await app.user.click(within(dialog).getByRole("button", { name: t("admin.close") }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
    // زرّ البطل مجرَّبٌ في «الأعضاء»؛ هذا زرّ بطاقة الأعضاء.
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.manageMembers")) }).at(-1)!);
    expect(await screen.findByText(t("admin.manageMembersTitle"))).toBeInTheDocument();
    await app.user.click(screen.getAllByRole("button", { name: t("admin.close") }).at(-1)!);

    await app.user.click(screen.getByRole("button", { name: esc(t("admin.proj.gotoTimeline")) }));
    expect(scrolled.mock.contexts.some((el) => (el as HTMLElement).id === "project-milestones")).toBe(true);
    scrolled.mockRestore();
  });

  it("معرّف السجلّ يُنسخ كاملاً ويقال «نُسخ»؛ وإخراج عضوٍ يُتراجع عنه بلا حذف", async () => {
    const app = await projectPage();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await app.user.click(screen.getByTitle(F.ID.g1));
    expect(writeText).toHaveBeenCalledWith(F.ID.g1);
    expect(await screen.findByText(t("admin.proj.idCopied"))).toBeInTheDocument();

    await app.user.click(screen.getAllByRole("button", { name: t("admin.proj.removeMember") })[0]!);
    const alert = await screen.findByRole("alertdialog");
    await app.user.click(within(alert).getByRole("button", { name: t("admin.cancel") }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fake.find("delete", /\/members\//)).toEqual([]);
  });

  it("وصفٌ طويل يُطوى، و«المزيد» يبسطه و«أقلّ» يطويه", async () => {
    withProject({ topic: { ...F.project.topic, description: "سطرٌ من الوصف. ".repeat(60) } });
    const app = await projectPage();
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.showMore") }));
    await app.user.click(screen.getByRole("button", { name: t("admin.proj.showLess") }));
    expect(screen.getByRole("button", { name: t("admin.proj.showMore") })).toBeInTheDocument();
  });
});
