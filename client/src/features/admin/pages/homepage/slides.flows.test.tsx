import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * صور الصفحة الرئيسية: تُضاف دفعةً (تُرفع واحدةً واحدة فور اختيارها، ولكلٍّ
 * تعليقها)، وتُعدَّل صورةً صورة.
 *
 * يُحرس: أنّ الحفظ لا يُتاح ورفعٌ جارٍ؛ وأنّ صورةً فشل رفعها تُعاد وحدها؛
 * وأنّ ملفّاً ليس صورةً يُقال سببه في صفّه؛ وأنّ ما يُحفظ هو روابط الرفع
 * بتعليقاتها، في موضعها (الرئيسية).
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const esc = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const png = (name: string) => new File(["png"], name, { type: "image/png" });

beforeEach(() => {
  fake.reset();
  localStorage.clear();
});

async function openAdd() {
  const app = renderApp("/ar/admin/homepage", { as: "admin" });
  await screen.findAllByText("حفل التخرّج");
  await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.slides.add")) })[0]!);
  const dialog = await screen.findByRole("dialog", { name: t("admin.slides.addTitle") });
  return { app, dialog, input: dialog.querySelector('input[type="file"]') as HTMLInputElement };
}

describe("إضافة صور", () => {
  it("صورتان تُرفعان، ولكلٍّ تعليقها، ثمّ تُحفظان معاً", async () => {
    const { app, dialog, input } = await openAdd();
    await app.user.upload(input, [png("a.png"), png("b.png")]);
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(2));
    const save = await within(dialog).findByRole("button", { name: esc(t("admin.slides.addCount", { count: 2 })) });
    await waitFor(() => expect(save).toBeEnabled());

    await app.user.type(within(dialog).getAllByRole("textbox", { name: t("admin.slides.caption") })[0]!, "المدرّج الكبير");
    await app.user.click(save);
    await waitFor(() => expect(fake.find("post", "/admin/home-slides/batch")).toHaveLength(1));
    expect(fake.find("post", "/admin/home-slides/batch")[0]!.body).toEqual({
      slides: [
        { imageUrl: "/uploads/cards/new.jpg", caption: "المدرّج الكبير" },
        { imageUrl: "/uploads/cards/new.jpg", caption: null },
      ],
      isActive: true,
      placement: "home",
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: t("admin.slides.addTitle") })).toBeNull());
  });

  it("رفعٌ يفشل ⇒ «أعد المحاولة» في صفّه وحده، ثمّ يُحفظ", async () => {
    let first = true;
    fake.on("post", "/admin/uploads/image", () => {
      if (first) {
        first = false;
        throw { status: 413, data: { message: "الملفّ كبير" } };
      }
      return { url: "/uploads/cards/ok.jpg" };
    });
    const { app, dialog, input } = await openAdd();
    await app.user.upload(input, png("big.png"));
    await app.user.click(await within(dialog).findByRole("button", { name: esc(t("admin.slides.retry")) }));
    const save = await within(dialog).findByRole("button", { name: esc(t("admin.slides.addCount", { count: 1 })) });
    await waitFor(() => expect(save).toBeEnabled());
    await app.user.click(save);
    await waitFor(() => expect(fake.find("post", "/admin/home-slides/batch")[0]?.body).toMatchObject({ slides: [{ imageUrl: "/uploads/cards/ok.jpg" }] }));
  });

  it("ملفٌّ ليس صورة ⇒ سببه في صفّه، ولا يُرفع؛ ويُزال من الدفعة", async () => {
    const { app, dialog, input } = await openAdd();
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "cv.pdf", { type: "application/pdf" })] } });
    expect(await within(dialog).findByText(t("admin.slides.badType"))).toBeInTheDocument();
    expect(fake.find("post", "/admin/uploads/image")).toEqual([]);
    await app.user.click(within(dialog).getByRole("button", { name: t("admin.slides.removeFromBatch") }));
    expect(within(dialog).queryByText(t("admin.slides.badType"))).toBeNull();
  });

  it("السحب والإفلات يضيفان كالاختيار، و«مسح الكلّ» يفرغ الدفعة", async () => {
    const { app, dialog } = await openAdd();
    const zone = within(dialog).getByRole("button", { name: esc(t("admin.slides.dropPromptMany")) });
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [png("drop.png")] } });
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.slides.clearAll")) }));
    expect(within(dialog).queryAllByRole("textbox", { name: t("admin.slides.caption") })).toHaveLength(0);
  });
});

describe("تعديل صورة", () => {
  it("التعليق يُحفظ، والصورة تُستبدل برفعٍ جديد", async () => {
    const app = renderApp("/ar/admin/homepage", { as: "admin" });
    await screen.findAllByText("حفل التخرّج");
    await app.user.click(screen.getAllByRole("button", { name: t("admin.edit") })[0]!);
    const dialog = await screen.findByRole("dialog", { name: t("admin.slides.editTitle") });
    const caption = within(dialog).getByDisplayValue("حفل التخرّج");
    await app.user.clear(caption);
    await app.user.type(caption, "تخرّج دفعة 2026");
    await app.user.upload(dialog.querySelector('input[type="file"]') as HTMLInputElement, png("new.png"));
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1));
    await app.user.click(within(dialog).getByRole("button", { name: esc(t("admin.slides.saveChanges")) }));
    await waitFor(() => expect(fake.find("patch", `/admin/home-slides/${F.slides[0]!.id}`)[0]?.body).toMatchObject({
      caption: "تخرّج دفعة 2026",
      imageUrl: "/uploads/cards/new.jpg",
    }));
    expect(await screen.findByText(t("admin.slides.toastSaved"))).toBeInTheDocument();
  });
});

describe("من بطاقة الصورة", () => {
  it("«تغيير» يرفع ملفّاً ويبدّل الصورة بلا نافذة", async () => {
    const app = renderApp("/ar/admin/homepage", { as: "admin" });
    await screen.findAllByText("حفل التخرّج");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.slides.replace")) })[0]!);
    const hidden = Array.from(document.querySelectorAll('input[type="file"]')).at(-1) as HTMLInputElement;
    fireEvent.change(hidden, { target: { files: [png("swap.png")] } });
    await waitFor(() => expect(fake.find("patch", `/admin/home-slides/${F.slides[0]!.id}`)[0]?.body).toEqual({ imageUrl: "/uploads/cards/new.jpg" }));
    expect(await screen.findByText(t("admin.slides.toastReplaced"))).toBeInTheDocument();
  });

  it("ملفٌّ لا يصلح للتبديل ⇒ سببه، ولا حفظ", async () => {
    const app = renderApp("/ar/admin/homepage", { as: "admin" });
    await screen.findAllByText("حفل التخرّج");
    await app.user.click(screen.getAllByRole("button", { name: esc(t("admin.slides.replace")) })[0]!);
    const hidden = Array.from(document.querySelectorAll('input[type="file"]')).at(-1) as HTMLInputElement;
    fireEvent.change(hidden, { target: { files: [new File(["x"], "a.gif", { type: "image/gif" })] } });
    expect(await screen.findByText(t("admin.slides.badType"))).toBeInTheDocument();
    expect(fake.find("patch", /^\/admin\/home-slides\//)).toEqual([]);
  });

  it("السحب والإفلات يعيدان الترتيب", async () => {
    renderApp("/ar/admin/homepage", { as: "admin" });
    await screen.findAllByText("حفل التخرّج");
    const cards = Array.from(document.querySelectorAll('[draggable="true"]')) as HTMLElement[];
    const data = { getData: () => F.slides[1]!.id, setData: () => {}, effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(cards[1]!, { dataTransfer: data });
    fireEvent.dragOver(cards[0]!, { dataTransfer: data });
    fireEvent.drop(cards[0]!, { dataTransfer: data });
    await waitFor(() => expect(fake.find("patch", "/admin/home-slides/order")[0]?.body).toEqual({ ids: [F.slides[1]!.id, F.slides[0]!.id], placement: "home" }));
  });
});
