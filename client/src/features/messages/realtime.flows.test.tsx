import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { FakeSocket } from "../../test/fake-socket";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";
import { useUIStore } from "../../store/ui.store";

/**
 * ما يصل من الخادم دون أن يُطلب: رسالةٌ جديدة تُعلن عن نفسها على أيّ شاشة —
 * من جرس اللوحة، أو في الزاوية خارجها —
 * وتغييرٌ في البيانات يُعيد جلب ما هو مفتوح، و«يكتب الآن…» في المحادثة.
 *
 * يُحرس: أنّ التنبيه يقود إلى المحادثة نفسها، ولا يظهر لمحادثةٍ مفتوحة أمام
 * صاحبها؛ وأنّ الصفحة تُعلم الطرف الآخر أنّها تكتب، بلا سيلٍ من الأحداث.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

let socket: FakeSocket;
beforeEach(() => {
  fake.reset();
  localStorage.clear();
  socket = new FakeSocket();
});

const message = {
  id: "m-live",
  threadId: null,
  subject: "تأجيل الموعد",
  preview: "نؤجّل لقاء الأحد إلى الإثنين",
  broadcast: null,
  createdAt: F.days(0),
  sender: { ...F.messageUser(F.profUsers[0]!), avatarUrl: null, gender: "male" },
};

describe("رسالةٌ جديدة", () => {
  it("في اللوحة: يتأرجح الجرس وتخرج منه فقاعتها — لا تنبيه في الزاوية؛ ونقرتها تقود إلى المحادثة", async () => {
    const app = renderApp("/ar/student", { as: "student", socket });
    await screen.findAllByText(F.topicFull.title);
    expect(screen.getByTestId("message-bell-icon")).toHaveAttribute("data-rings", "0");
    act(() => socket.server("message:new", message));
    const bubble = await screen.findByTestId("bell-bubble");
    expect(bubble).toHaveTextContent(message.preview);
    expect(bubble).toHaveTextContent(message.subject);
    expect(screen.getByTestId("message-bell-icon")).toHaveAttribute("data-rings", "1");
    expect(screen.queryByTestId("message-toast")).toBeNull();
    await app.user.click(within(bubble).getByText(message.preview));
    await waitFor(() => expect(app.location()).toBe(`/ar/student/messages?c=${F.profUsers[0]!.id}`));
  });

  it("ويرنّ الجرس بصوت تنبيه الرسائل — ولا صوت والمحادثة مفتوحة", async () => {
    useUIStore.setState({ sound: true });
    const played: string[] = [];
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      played.push(decodeURIComponent(this.src));
      return Promise.resolve();
    });
    try {
      renderApp("/ar/student", { as: "student", socket });
      await screen.findAllByText(F.topicFull.title);
      act(() => socket.server("message:new", message));
      await screen.findByTestId("bell-bubble");
      expect(played.filter((src) => src.endsWith("/sounds/Voicy_Notification Of Playstation 5.mp3"))).toHaveLength(1);
    } finally {
      play.mockRestore();
    }
  });

  it("وتُغلق الفقاعة بزرّها", async () => {
    const app = renderApp("/ar/professor", { as: "professor", socket });
    await screen.findAllByText(F.topicFull.title);
    act(() => socket.server("message:new", { ...message, broadcast: "all", sender: F.messageUser(F.adminUser) }));
    const bubble = await screen.findByTestId("bell-bubble");
    expect(bubble).toHaveTextContent(t("msg.toast.broadcast"));
    await app.user.click(within(bubble).getByRole("button", { name: t("msg.close") }));
    await waitFor(() => expect(screen.queryByTestId("bell-bubble")).toBeNull());
  });

  it("وخارج اللوحات — صفحات الموقع العامّة، بلا جرس — تنبيهٌ في الزاوية، و«فتح» يقود إلى المحادثة", async () => {
    const app = renderApp("/ar/topics", { as: "student", socket });
    await screen.findAllByText(F.topicFull.title);
    expect(screen.queryByTestId("message-bell")).toBeNull();
    act(() => socket.server("message:new", message));
    expect(await screen.findByTestId("message-toast")).toHaveTextContent(message.preview);
    await app.user.click(screen.getByRole("button", { name: new RegExp(t("msg.toast.open")) }));
    await waitFor(() => expect(app.location()).toBe(`/ar/student/messages?c=${F.profUsers[0]!.id}`));
  });

  it("ولا شيء والمحادثة مع مرسلها مفتوحة أمام صاحبها", async () => {
    renderApp(`/ar/student/messages?c=${F.profUsers[0]!.id}`, { as: "student", socket });
    await screen.findByTestId("chat-view");
    act(() => socket.server("message:new", message));
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByText(message.preview)).toBeNull();
    expect(screen.queryByTestId("bell-bubble")).toBeNull();
    expect(screen.getByTestId("message-bell-icon")).toHaveAttribute("data-rings", "0");
  });
});

describe("تغيّر البيانات", () => {
  it("إعلان الخادم عن مواضيع تغيّرت ⇒ تُجلب من جديد", async () => {
    renderApp("/ar/professor/topics", { as: "professor", socket });
    await screen.findAllByText(F.topicOpen.title);
    const before = fake.find("get", "/professor/topics").length;
    act(() => socket.server("data:changed", { resource: "topics", action: "updated", at: F.days(0) }));
    await waitFor(() => expect(fake.find("get", "/professor/topics").length).toBeGreaterThan(before));
  });
});

describe("يكتب الآن", () => {
  it("الطرف الآخر يكتب ⇒ يظهر، ويختفي حين يتوقّف؛ وكتابتي تُعلَم مرّةً لا مع كلّ حرف", async () => {
    const app = renderApp(`/ar/student/messages?c=${F.profUsers[0]!.id}`, { as: "student", socket });
    await screen.findByTestId("chat-view");
    const status = screen.getByTestId("chat-status");
    const idle = status.textContent;

    act(() => socket.server("typing", { from: F.profUsers[0]!.id, active: true }));
    await waitFor(() => expect(screen.getByTestId("chat-status").textContent).not.toBe(idle));
    act(() => socket.server("typing", { from: F.profUsers[0]!.id, active: false }));
    await waitFor(() => expect(screen.getByTestId("chat-status").textContent).toBe(idle));

    await app.user.type(screen.getByTestId("chat-input"), "أهلاً أستاذ");
    const typing = socket.sent.filter((e) => e.event === "typing");
    expect(typing.length).toBe(1);
    expect(typing[0]!.payload).toEqual({ to: F.profUsers[0]!.id, active: true });
    await app.user.click(screen.getByTestId("chat-send"));
    await waitFor(() => expect(socket.sent.at(-1)).toEqual({ event: "typing", payload: { to: F.profUsers[0]!.id, active: false } }));
  });

  it("وفي قائمة المحادثات: «يكتب…» مكان آخر سطر", async () => {
    renderApp("/ar/student/messages", { as: "student", socket });
    const rows = await screen.findAllByTestId("chat-row");
    act(() => socket.server("typing", { from: F.profUsers[0]!.id, active: true }));
    await waitFor(() => expect(within(rows[0]!.parentElement!).queryAllByTestId("row-typing").length).toBeGreaterThan(0));
  });
});
