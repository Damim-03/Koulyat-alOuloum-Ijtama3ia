import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";

/**
 * ما بعد الإرسال: تعديل النصّ خلال ١٥ دقيقة لكلّ الأدوار، وحذف الرسالة عند
 * الجميع للإدارة وحدها.
 *
 * يُحرس: أنّ «تعديل» لا يظهر لرسالةٍ مضت دقائقها ولا لرسالة غيري؛ وأنّ «حذف
 * عند الجميع» لا يظهر إلّا للمسؤول؛ وأنّ الحذف يُسأل عنه قبل أن يُرسَل؛ وأنّ
 * ما كان يُكتب قبل التعديل لا يضيع؛ وأنّ المحذوفة تزول بلا أثر.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

const OTHER = F.profUsers[0]!;
const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

/** The chat with one message of mine sent `minutesAgo`, and theirs before it. */
function chatWithMine(minutesAgo: number, extra: object = {}) {
  fake.on("get", "/messages/chat/:userId", (r) => {
    const page = F.chat(F.authUsers.student as never, r.params.userId!);
    page.items[1] = { ...page.items[1]!, id: "mine-1", body: "موعدنا الأحد", createdAt: iso(minutesAgo), ...extra };
    return page;
  });
}

async function openChat(as: "student" | "admin" = "student", other = OTHER.id) {
  const app = renderApp(`/ar/${as}/messages?c=${other}`, { as });
  await screen.findByTestId("chat-view");
  return app;
}
const myBubble = () => screen.getAllByTestId("chat-bubble").find((b) => b.dataset.mine)!;

describe("التعديل", () => {
  it("رسالتي قبل دقائق ⇒ «تعديل» يضع نصّها في محرّر؛ Enter يحفظ فتُعلَّم «معدّلة»، وما كنت أكتبه يعود", async () => {
    chatWithMine(2);
    const app = await openChat();
    await app.user.type(screen.getByTestId("chat-input"), "مسودّة لم تُرسل");

    await app.user.click(within(myBubble()).getByTestId("message-actions"));
    // A student withdraws nothing: edit only.
    expect(screen.queryByTestId("message-delete")).toBeNull();
    await app.user.click(screen.getByTestId("message-edit"));

    const input = screen.getByTestId("edit-input");
    expect(input).toHaveValue("موعدنا الأحد");
    await app.user.clear(input);
    await app.user.type(input, "موعدنا الإثنين{Enter}");

    await waitFor(() => expect(fake.find("patch", "/messages/mine-1")).toHaveLength(1));
    expect(fake.find("patch", "/messages/mine-1")[0]!.body).toEqual({ body: "موعدنا الإثنين" });
    expect(within(myBubble()).getByText("موعدنا الإثنين")).toBeInTheDocument();
    expect(within(myBubble()).getByTestId("edited")).toHaveTextContent(t("msg.edited"));
    expect(screen.queryByTestId("edit-composer")).toBeNull();
    expect(screen.getByTestId("chat-input")).toHaveValue("مسودّة لم تُرسل");
  });

  it("وEscape يلغي التعديل بلا طلب", async () => {
    chatWithMine(2);
    const app = await openChat();
    await app.user.click(within(myBubble()).getByTestId("message-actions"));
    await app.user.click(screen.getByTestId("message-edit"));
    await app.user.type(screen.getByTestId("edit-input"), " تغيير");
    await app.user.keyboard("{Escape}");
    expect(screen.queryByTestId("edit-composer")).toBeNull();
    expect(fake.find("patch", /^\/messages\/mine-1$/)).toEqual([]);
    expect(within(myBubble()).getByText("موعدنا الأحد")).toBeInTheDocument();
  });

  it("رسالةٌ مضت عليها ١٥ دقيقة ⇒ لا «تعديل»، ولا زرّ خيارات لطالب", async () => {
    chatWithMine(20);
    await openChat();
    expect(within(myBubble()).queryByTestId("message-actions")).toBeNull();
  });

  it("والخادم يرفض ⇒ يعود النصّ القديم ويُقال السبب", async () => {
    chatWithMine(2);
    fake.fail("patch", "/messages/:id", 400, "لا تُعدَّل الرسالة إلا خلال 15 دقيقة من إرسالها.");
    const app = await openChat();
    await app.user.click(within(myBubble()).getByTestId("message-actions"));
    await app.user.click(screen.getByTestId("message-edit"));
    await app.user.type(screen.getByTestId("edit-input"), " جديد{Enter}");
    expect(await screen.findByText("لا تُعدَّل الرسالة إلا خلال 15 دقيقة من إرسالها.")).toBeInTheDocument();
    await waitFor(() => expect(within(myBubble()).getByText("موعدنا الأحد")).toBeInTheDocument());
    expect(within(myBubble()).queryByTestId("edited")).toBeNull();
  });
});

describe("الحذف عند الجميع", () => {
  it("المسؤول: «حذف عند الجميع» يُسأل عنه، ثمّ تزول الرسالة بلا أثر", async () => {
    chatWithMine(300); // old: no edit any more, but the administration still withdraws it
    const app = await openChat("admin", F.studentUsers[0]!.id);
    await app.user.click(within(myBubble()).getByTestId("message-actions"));
    expect(screen.queryByTestId("message-edit")).toBeNull();
    await app.user.click(screen.getByTestId("message-delete"));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(t("msg.actions.confirmTitle"))).toBeInTheDocument();
    expect(fake.find("delete", "/messages/mine-1/for-everyone")).toEqual([]);
    await app.user.click(within(dialog).getByRole("button", { name: new RegExp(t("msg.actions.confirm")) }));

    await waitFor(() => expect(fake.find("delete", "/messages/mine-1/for-everyone")).toHaveLength(1));
    // Gone — not replaced by a "deleted" line: theirs is all that is left.
    await waitFor(() => expect(screen.queryByText("موعدنا الأحد")).toBeNull());
    expect(screen.getAllByTestId("chat-bubble").filter((b) => b.dataset.mine)).toEqual([]);
    expect(screen.getByText("السلام عليكم")).toBeInTheDocument();
  });
});

describe("في نافذة القراءة (التعميمات والمحادثات القديمة)", () => {
  /** A thread whose reply is mine, sent `minutesAgo`. */
  const withMyReply = (minutesAgo: number) =>
    fake.on("get", "/messages/:id", (r) => {
      const th = F.thread(F.authUsers.admin as never, r.params.id!);
      th.thread[1] = { ...th.thread[1]!, createdAt: iso(minutesAgo) };
      return th;
    });

  it("المسؤول يعدّل ردّه في مكانه، ويحذفه عند الجميع بعد السؤال", async () => {
    withMyReply(3);
    const app = renderApp("/ar/admin/messages?b=m7", { as: "admin" });
    const reader = await screen.findByTestId("message-reader");
    const mine = () => within(reader).getAllByTestId("bubble").find((b) => b.dataset.mine)!;

    await app.user.click(within(mine()).getByTestId("reader-edit"));
    const input = within(mine()).getByTestId("inline-edit-input");
    await app.user.clear(input);
    await app.user.type(input, "حاضر، الأحد إذن.");
    await app.user.click(within(mine()).getByTestId("inline-edit-save"));
    await waitFor(() => expect(fake.find("patch", "/messages/m7-r")[0]?.body).toEqual({ body: "حاضر، الأحد إذن." }));

    await app.user.click(within(mine()).getByTestId("reader-delete-everyone"));
    const dialog = await screen.findByRole("alertdialog");
    await app.user.click(within(dialog).getByRole("button", { name: new RegExp(t("msg.actions.confirm")) }));
    await waitFor(() => expect(fake.find("delete", "/messages/m7-r/for-everyone")).toHaveLength(1));
  });

  it("ولغير المسؤول: «تعديل» لردّه الحديث، ولا «حذف عند الجميع»", async () => {
    fake.on("get", "/messages/:id", (r) => {
      const th = F.thread(F.authUsers.professor as never, r.params.id!);
      th.thread[1] = { ...th.thread[1]!, createdAt: iso(3) };
      return th;
    });
    renderApp("/ar/professor/messages?b=m7", { as: "professor" });
    const reader = await screen.findByTestId("message-reader");
    const mine = within(reader).getAllByTestId("bubble").find((b) => b.dataset.mine)!;
    expect(within(mine).getByTestId("reader-edit")).toBeInTheDocument();
    expect(within(mine).queryByTestId("reader-delete-everyone")).toBeNull();
  });
});
