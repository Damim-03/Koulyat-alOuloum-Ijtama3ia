import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../i18n/i18n";
import { fake } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";
import * as F from "../../test/fixtures";

// pdf.js draws on canvases jsdom does not have: a document of three pages
// stands in for it, and a page draws at once.
const pdf3 = vi.hoisted(() => ({
  open: vi.fn(),
}));
vi.mock("../../lib/pdf", () => ({
  openPdf: pdf3.open,
  isPasswordError: (e: unknown) => (e as { name?: string })?.name === "PasswordException",
}));
const fakePdf = (pages = 3) => ({
  doc: {
    numPages: pages,
    getPage: async () => ({
      getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
      render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    }),
  },
  close: vi.fn(async () => {}),
});

/**
 * الملفات في الرسائل: رمز الإرفاق يفتح نافذةً تُفلَت فيها الملفات أو تُختار،
 * فتُرفع في الحال، وتُرسل مع الرسالة أو وحدها، وتُفتح عند المستلم — الصورة
 * في مكانها، والـPDF في نافذة قراءةٍ كبيرة، وغيرهما تنزيلاً.
 *
 * يُحرس: أنّ ما يُرسَل هو معرّفات الملفات المرفوعة لا الملفات نفسها؛ وأنّ ما
 * يرفضه الخادم يُرفض هنا قبل الرفع؛ وأنّ الرسالة لا تخرج وملفٌّ منها لم
 * يُرفع؛ وأنّ ملفّاً تُرك قبل الإرسال لا يبقى على الخادم.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

beforeEach(() => {
  fake.reset();
  localStorage.clear();
  pdf3.open.mockReset();
  pdf3.open.mockResolvedValue(fakePdf());
});

const pdf = (name = "الفصل الأول.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf" });
const png = (name = "لقطة.png") => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: "image/png" });

async function openChat() {
  const app = renderApp(`/ar/student/messages?c=${F.profUsers[0]!.id}`, { as: "student" });
  await screen.findByTestId("chat-view");
  return app;
}

/** Through the attach window: open it, pick, close it — the files wait in the composer. */
function pick(files: File[], scope: HTMLElement = document.body) {
  fireEvent.click(within(scope).getByTestId("attach-button"));
  const dialog = screen.getByTestId("attach-dialog");
  fireEvent.change(within(dialog).getByTestId("attach-input"), { target: { files } });
  fireEvent.click(within(dialog).getByTestId("attach-done"));
}

describe("في المحادثة", () => {
  it("ملفٌّ يُختار ⇒ يُرفع، ثمّ يُرسل وحده بمعرّفه، ويظهر في الفقاعة", async () => {
    const app = await openChat();
    pick([pdf()]);
    await waitFor(() => expect(screen.getByTestId("draft")).toHaveAttribute("data-status", "ready"));
    expect(fake.find("post", "/messages/attachments")).toHaveLength(1);

    await app.user.click(screen.getByTestId("chat-send"));
    await waitFor(() => expect(fake.find("post", "/messages")).toHaveLength(1));
    expect(fake.find("post", "/messages")[0]!.body).toEqual({
      recipientIds: [F.profUsers[0]!.id],
      body: "",
      attachmentIds: ["att-الفصل الأول.pdf"],
    });
    expect(screen.queryByTestId("draft")).toBeNull();
    const bubble = screen.getAllByTestId("chat-bubble").at(-1)!;
    expect(within(bubble).getByText("الفصل الأول.pdf")).toBeInTheDocument();
    // أُرسل: لا يُحذف من الخادم.
    expect(fake.find("delete", /^\/messages\/attachments\//)).toEqual([]);
  });

  it("ونصٌّ مع ملفّين ⇒ يُرسلان معاً", async () => {
    const app = await openChat();
    pick([pdf("أ.pdf"), pdf("ب.pdf")]);
    await waitFor(() => expect(screen.getAllByTestId("draft").every((d) => d.dataset.status === "ready")).toBe(true));
    await app.user.type(screen.getByTestId("chat-input"), "المرفقات");
    await app.user.click(screen.getByTestId("chat-send"));
    await waitFor(() => expect(fake.find("post", "/messages")).toHaveLength(1));
    expect(fake.find("post", "/messages")[0]!.body).toMatchObject({ body: "المرفقات", attachmentIds: ["att-أ.pdf", "att-ب.pdf"] });
  });

  it("نوعٌ غير مدعوم أو حجمٌ فوق ٢٥ ميغابايت ⇒ يُقال في الحال، ولا يُرفع شيء", async () => {
    await openChat();
    const big = pdf("كبير.pdf");
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });
    pick([new File(["MZ"], "setup.exe"), big]);
    expect(await screen.findByText(t("msg.files.badType", { name: "setup.exe" }))).toBeInTheDocument();
    expect(await screen.findByText(t("msg.files.tooLarge", { name: "كبير.pdf", max: 25 }))).toBeInTheDocument();
    expect(fake.find("post", "/messages/attachments")).toEqual([]);
    expect(screen.queryByTestId("draft")).toBeNull();
  });

  it("وأكثر من ٥ ملفات ⇒ تُقبل الخمسة الأولى، ويُقال لماذا لا السادس", async () => {
    await openChat();
    pick(Array.from({ length: 6 }, (_, i) => pdf(`f${i}.pdf`)));
    expect(await screen.findByText(t("msg.files.tooMany", { max: 5 }))).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId("draft")).toHaveLength(5));
    expect(screen.getByTestId("attach-button")).toBeDisabled();
  });

  it("رفعٌ يفشل ⇒ سببه على الملف، والإرسال ممنوع حتى يُزال", async () => {
    fake.fail("post", "/messages/attachments", 400, "محتوى الملف لا يطابق امتداده");
    const app = await openChat();
    pick([pdf()]);
    expect(await screen.findByText("محتوى الملف لا يطابق امتداده")).toBeInTheDocument();
    expect(screen.getByTestId("draft")).toHaveAttribute("data-status", "failed");
    await app.user.type(screen.getByTestId("chat-input"), "نصّ");
    expect(screen.getByTestId("chat-send")).toBeDisabled();

    await app.user.click(screen.getByTestId("draft-remove"));
    expect(screen.getByTestId("chat-send")).toBeEnabled();
  });

  it("ملفٌّ يُزال قبل الإرسال ⇒ يُحذف من الخادم", async () => {
    const app = await openChat();
    pick([pdf()]);
    await waitFor(() => expect(screen.getByTestId("draft")).toHaveAttribute("data-status", "ready"));
    await app.user.click(screen.getByTestId("draft-remove"));
    await waitFor(() => expect(fake.find("delete", /^\/messages\/attachments\//)).toHaveLength(1));
    expect(screen.queryByTestId("draft")).toBeNull();
    expect(screen.getByTestId("chat-send")).toBeDisabled();
  });

  it("ملفٌّ يُسحب ويُفلت على المحادثة ⇒ يُرفق", async () => {
    await openChat();
    const view = screen.getByTestId("chat-view");
    const dataTransfer = { types: ["Files"], files: [pdf("مسحوب.pdf")] };
    fireEvent.dragEnter(view, { dataTransfer });
    expect(screen.getByTestId("drop-overlay")).toBeInTheDocument();
    fireEvent.drop(view, { dataTransfer });
    expect(screen.queryByTestId("drop-overlay")).toBeNull();
    await waitFor(() => expect(fake.find("post", "/messages/attachments")).toHaveLength(1));
    expect(screen.getByText("مسحوب.pdf")).toBeInTheDocument();
  });
});

describe("عند المستلم", () => {
  const withFiles = () =>
    fake.on("get", "/messages/chat/:userId", (r) => {
      const page = F.chat(F.authUsers.student as never, r.params.userId!);
      page.items[0] = {
        ...page.items[0]!,
        body: "",
        attachments: [
          { id: "f-doc", fileName: "خطة البحث.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 48_000 },
          { id: "f-img", fileName: "مخطط.png", mimeType: "image/png", size: 120_000 },
        ],
      };
      return page;
    });

  it("المستند بطاقةٌ تُنزَّل باسمه، بالجلسة لا برابطٍ مكشوف", async () => {
    withFiles();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const app = await openChat();
    const card = await screen.findByTestId("attachment-file");
    expect(within(card).getByText("خطة البحث.docx")).toBeInTheDocument();
    expect(within(card).getByText(new RegExp(t("msg.files.kind.word")))).toBeInTheDocument();

    await app.user.click(within(card).getByTestId("attachment-download"));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(fake.find("get", "/messages/attachments/f-doc")).toHaveLength(1);
    expect((click.mock.contexts.at(-1) as HTMLAnchorElement).download).toBe("خطة البحث.docx");
    click.mockRestore();
  });

  it("والصورة تُعرض في مكانها، وتُفتح كبيرةً ويغلقها Escape", async () => {
    withFiles();
    const app = await openChat();
    const thumb = await screen.findByTestId("attachment-image");
    await waitFor(() => expect(within(thumb).getByRole("img")).toHaveAttribute("src", expect.stringMatching(/^blob:/)));
    expect(fake.find("get", "/messages/attachments/f-img")[0]!.query).toEqual({ inline: 1 });

    await app.user.click(thumb);
    expect(await screen.findByTestId("image-viewer")).toBeInTheDocument();
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("image-viewer")).toBeNull());
  });

  it("وقائمة المحادثات تسمّي الملفّ حين لا نصّ", async () => {
    fake.on("get", "/messages/conversations", () => {
      const items = F.conversations(F.authUsers.student as never);
      items[0] = { ...items[0]!, last: { ...items[0]!.last!, preview: "", file: { fileName: "الفصل الثاني.pdf", mimeType: "application/pdf", count: 2 } } };
      return { items, unread: 2 };
    });
    renderApp("/ar/student/messages", { as: "student" });
    expect(await screen.findByText(t("msg.files.previewMany", { name: "الفصل الثاني.pdf", more: 1 }))).toBeInTheDocument();
  });
});

describe("رسالة جديدة وتعميم", () => {
  it("تعميمٌ بملفّ ⇒ يحمل معرّفه", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click(await screen.findByRole("button", { name: new RegExp(t("msg.broadcastNew")) }));
    const dialog = await screen.findByTestId("compose-dialog");
    pick([pdf("جدول المناقشات.pdf")], dialog);
    await waitFor(() => expect(within(dialog).getByTestId("draft")).toHaveAttribute("data-status", "ready"));
    await waitFor(() => expect(within(dialog).getByTestId("compose-send")).toHaveClass("bg-gold"));
    await app.user.click(within(dialog).getByTestId("compose-send"));
    await waitFor(() => expect(fake.find("post", "/messages/broadcast")).toHaveLength(1));
    expect(fake.find("post", "/messages/broadcast")[0]!.body).toMatchObject({ body: "", attachmentIds: ["att-جدول المناقشات.pdf"] });
    // أُرسل: ليس مسوّدةً تُحذف حين تُغلق النافذة.
    await waitFor(() => expect(screen.queryByTestId("compose-dialog")).toBeNull());
    expect(fake.find("delete", /^\/messages\/attachments\//)).toEqual([]);
  });

  it("نافذةٌ تُغلق وفيها ملفٌّ لم يُرسل ⇒ يُحذف من الخادم", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click((await screen.findAllByRole("button", { name: new RegExp(t("messages.newMessage")) }))[0]!);
    const dialog = await screen.findByTestId("compose-dialog");
    pick([png()], dialog);
    await waitFor(() => expect(within(dialog).getByTestId("draft")).toHaveAttribute("data-status", "ready"));
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("compose-dialog")).toBeNull());
    await waitFor(() => expect(fake.find("delete", /^\/messages\/attachments\//)).toHaveLength(1));
  });
});

describe("نافذة الإرفاق", () => {
  it("رمز الإرفاق يفتح نافذةً تُفلَت فيها الملفات: تُرفع مرّةً واحدة، و«تمّ» يُبقيها في الرسالة", async () => {
    const app = await openChat();
    await app.user.click(screen.getByTestId("attach-button"));
    const dialog = await screen.findByTestId("attach-dialog");
    const zone = within(dialog).getByTestId("attach-dropzone");
    expect(within(dialog).getByText(t("msg.files.dragHere"))).toBeInTheDocument();

    const dataTransfer = { types: ["Files"], files: [pdf("مُفلَت.pdf")], dropEffect: "none" };
    fireEvent.dragEnter(zone, { dataTransfer });
    expect(zone).toHaveAttribute("data-over", "true");
    expect(within(dialog).getByText(t("msg.files.release"))).toBeInTheDocument();
    // The chat behind does not take it too.
    expect(screen.queryByTestId("drop-overlay")).toBeNull();

    fireEvent.drop(zone, { dataTransfer });
    await waitFor(() => expect(within(dialog).getByTestId("draft")).toHaveAttribute("data-status", "ready"));
    expect(fake.find("post", "/messages/attachments")).toHaveLength(1);
    expect(within(dialog).getByTestId("attach-status")).toHaveTextContent(t("msg.files.readyCount", { count: 1 }));

    await app.user.click(within(dialog).getByTestId("attach-done"));
    await waitFor(() => expect(screen.queryByTestId("attach-dialog")).toBeNull());
    expect(screen.getByTestId("chat-view")).toBeInTheDocument();
    expect(screen.getByTestId("draft")).toHaveTextContent("مُفلَت.pdf");
    expect(screen.getByTestId("chat-send")).toBeEnabled();
    expect(fake.find("delete", /^\/messages\/attachments\//)).toEqual([]);
  });

  it.each([
    ["✕", (app: Awaited<ReturnType<typeof openChat>>) => app.user.click(screen.getByTestId("attach-cancel-x"))],
    ["Escape", (app: Awaited<ReturnType<typeof openChat>>) => app.user.keyboard("{Escape}")],
    ["«إلغاء»", (app: Awaited<ReturnType<typeof openChat>>) => app.user.click(screen.getByTestId("attach-cancel"))],
  ])("الإغلاق بـ%s ⇒ لا يبقى ما أُضيف هذه المرّة، ويُحذف من الخادم؛ وما ثُبّت قبلها يبقى", async (_how, close) => {
    const app = await openChat();
    pick([pdf("سابق.pdf")]); // added and kept with «Done»
    await waitFor(() => expect(screen.getByTestId("draft")).toHaveAttribute("data-status", "ready"));

    await app.user.click(screen.getByTestId("attach-button"));
    const dialog = await screen.findByTestId("attach-dialog");
    fireEvent.change(within(dialog).getByTestId("attach-input"), { target: { files: [pdf("جديد.pdf")] } });
    await waitFor(() => expect(within(dialog).getAllByTestId("draft")).toHaveLength(2));
    await waitFor(() => expect(within(dialog).getAllByTestId("draft").every((d) => d.dataset.status === "ready")).toBe(true));

    await close(app);
    await waitFor(() => expect(screen.queryByTestId("attach-dialog")).toBeNull());
    expect(screen.getAllByTestId("draft")).toHaveLength(1);
    expect(screen.getByTestId("draft")).toHaveTextContent("سابق.pdf");
    await waitFor(() => expect(fake.find("delete", /^\/messages\/attachments\//)).toHaveLength(1));
    // The new one — not the one kept before.
    expect(decodeURIComponent(fake.find("delete", /^\/messages\/attachments\//)[0]!.path)).toContain("جديد.pdf");
  });

  it("ملفٌّ يدخل ⇒ يظهر نوعه على بطاقته، وتُحدَّد شارة نوعه بين الأنواع المقبولة", async () => {
    const app = await openChat();
    await app.user.click(screen.getByTestId("attach-button"));
    const dialog = await screen.findByTestId("attach-dialog");
    const chip = (kind: string) => within(dialog).getAllByTestId("kind-chip").find((c) => c.dataset.kind === kind)!;
    expect(within(dialog).getAllByTestId("kind-chip").filter((c) => c.dataset.selected)).toEqual([]);

    const xlsx = new File(["PK"], "النتائج.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(within(dialog).getByTestId("attach-input"), { target: { files: [xlsx, pdf("أ.pdf"), pdf("ب.pdf")] } });

    await waitFor(() => expect(chip("excel")).toHaveAttribute("data-selected", "true"));
    expect(chip("pdf")).toHaveAttribute("data-selected", "true");
    expect(chip("pdf")).toHaveTextContent("×2");
    expect(chip("word")).not.toHaveAttribute("data-selected");
    const kinds = within(dialog).getAllByTestId("draft-kind").map((k) => k.textContent);
    expect(kinds).toEqual([t("msg.files.kind.excel"), t("msg.files.kind.pdf"), t("msg.files.kind.pdf")]);
  });

  it("وفوق نافذة الرسالة الجديدة: Escape يغلق نافذة الإرفاق وحدها", async () => {
    const app = renderApp("/ar/admin/messages", { as: "admin" });
    await app.user.click((await screen.findAllByRole("button", { name: new RegExp(t("messages.newMessage")) }))[0]!);
    const compose = await screen.findByTestId("compose-dialog");
    await app.user.click(within(compose).getByTestId("attach-button"));
    await screen.findByTestId("attach-dialog");
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("attach-dialog")).toBeNull());
    expect(screen.getByTestId("compose-dialog")).toBeInTheDocument();
  });
});

describe("قراءة PDF", () => {
  const withPdf = () =>
    fake.on("get", "/messages/chat/:userId", (r) => {
      const page = F.chat(F.authUsers.student as never, r.params.userId!);
      page.items[0] = {
        ...page.items[0]!,
        attachments: [
          { id: "f-pdf", fileName: "المذكرة.pdf", mimeType: "application/pdf", size: 2_400_000 },
          { id: "f-doc", fileName: "خطة.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 48_000 },
        ],
      };
      return page;
    });

  it("الـPDF يُفتح في نافذة قراءةٍ كبيرة بصفحاته؛ ويُنزَّل منها؛ وEscape يغلقها", async () => {
    withPdf();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const app = await openChat();
    const [pdfCard, docCard] = await screen.findAllByTestId("attachment-file");
    // The PDF is read here; a Word file is only downloaded.
    expect(within(docCard!).queryByTestId("attachment-open")).toBeNull();

    await app.user.click(within(pdfCard!).getByTestId("attachment-open"));
    const viewer = await screen.findByTestId("pdf-viewer");
    expect(within(viewer).getByText("المذكرة.pdf")).toBeInTheDocument();
    await waitFor(() => expect(within(viewer).getAllByTestId("pdf-page-box")).toHaveLength(3));
    expect(within(viewer).getByText(new RegExp(t("msg.pdf.pages", { count: 3 })))).toBeInTheDocument();
    expect(within(viewer).getByTestId("pdf-page")).toHaveTextContent(t("msg.pdf.pageOf", { page: 1, total: 3 }));
    expect(fake.find("get", "/messages/attachments/f-pdf")).toHaveLength(1);
    expect(pdf3.open).toHaveBeenCalledTimes(1);

    await app.user.click(within(viewer).getByTestId("pdf-download"));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect((click.mock.contexts.at(-1) as HTMLAnchorElement).download).toBe("المذكرة.pdf");
    click.mockRestore();

    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("pdf-viewer")).toBeNull());
  });

  it("والضغط على اسم الملف يفتحه كذلك، والتكبير يغيّر النسبة", async () => {
    withPdf();
    const app = await openChat();
    const [pdfCard] = await screen.findAllByTestId("attachment-file");
    await app.user.click(within(pdfCard!).getByTestId("attachment-open-name"));
    const viewer = await screen.findByTestId("pdf-viewer");
    await waitFor(() => expect(within(viewer).getAllByTestId("pdf-page-box")).toHaveLength(3));
    // jsdom has no width: the fit is 100%; zooming in goes to the next step.
    const zoom = within(viewer).getByTestId("pdf-zoom");
    const before = zoom.textContent;
    await app.user.click(within(viewer).getByRole("button", { name: t("msg.pdf.zoomIn") }));
    expect(zoom.textContent).not.toBe(before);
  });

  it("ملفٌّ محميّ بكلمة مرور ⇒ يُقال ذلك، ويُعرض تنزيله بدلاً منه", async () => {
    withPdf();
    pdf3.open.mockRejectedValue({ name: "PasswordException" });
    const app = await openChat();
    const [pdfCard] = await screen.findAllByTestId("attachment-file");
    await app.user.click(within(pdfCard!).getByTestId("attachment-open"));
    const error = await screen.findByTestId("pdf-error");
    expect(within(error).getByText(t("msg.pdf.locked"))).toBeInTheDocument();
    expect(within(error).getByRole("button", { name: new RegExp(t("msg.pdf.download")) })).toBeInTheDocument();
  });
});
