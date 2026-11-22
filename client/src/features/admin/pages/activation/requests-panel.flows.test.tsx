import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../../i18n/i18n";
import { fake } from "../../../../test/fake-api";
import { renderApp } from "../../../../test/render-app";
import * as F from "../../../../test/fixtures";

/**
 * طلبات التوثيق بالصور (Backend modules/activation).
 *
 * يُحرس: أنّها ما يُفتح أوّلاً، وعددها على اللسان؛ وأنّ الصورتين تُجلبان بالجلسة
 * وتُعرضان؛ وأنّ القبول لا يكون قبل علامة المطابقة، ويُرسل معه وقت الطلب الذي
 * رُوجع؛ وأنّ الرفض لا يكون بلا سبب، ويُرسل السبب؛ وأنّ القائمة الفارغة تقول
 * ذلك؛ وأنّ «مكتب التفعيل» جزءٌ آخر يسكن الرابط؛ وأنّ طلباً وصل بلا صور قبل أن
 * تُشترط يُعرض بلا صوره.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));
const R = F.activationRequest;

// jsdom has no object URLs: the photos fetched become these.
const created = URL.createObjectURL;
const revoked = URL.revokeObjectURL;
beforeEach(() => {
  fake.reset();
  localStorage.clear();
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  URL.createObjectURL = created;
  URL.revokeObjectURL = revoked;
});

async function requests() {
  const app = renderApp("/ar/admin/users?view=requests", { as: "admin" });
  const card = await screen.findByTestId("activation-request");
  return { app, card };
}

describe("طلبات التوثيق", () => {
  it("تُفتح أوّلاً بعددها؛ وصورة البطاقة وحدها تُعرض؛ والقبول بعد التحقّق منها، بوقت الطلب المراجَع", async () => {
    const { app, card } = await requests();
    expect(screen.getByTestId("users-view-requests")).toHaveTextContent("1");
    expect(card).toHaveTextContent("سارة مزيان");
    expect(card).toHaveTextContent(R.registrationNumber);
    expect(card).toHaveTextContent(t("admin.activation.requests.qrMatch"));

    expect(await within(card).findByTestId("request-photo-card")).toHaveAttribute("src", "blob:photo");
    // The card alone: no second photo, no «not sent» in its place — and the tick is about the card.
    expect(within(card).queryByTestId("request-photo-selfie")).toBeNull();
    expect(within(card).queryByTestId("request-no-photo")).toBeNull();
    expect(fake.find("get", `/admin/activation/requests/${R.id}/selfie`)).toHaveLength(0);
    expect(card).toHaveTextContent(t("admin.activation.requests.checkCard"));
    expect(card).toHaveTextContent(t("admin.activation.requests.cardLabel"));
    expect(fake.find("get", `/admin/activation/requests/${R.id}/card`)).toHaveLength(1);

    const approve = within(card).getByTestId("request-approve");
    expect(approve).toHaveTextContent(t("admin.activation.requests.approveVerify"));
    expect(approve).toBeDisabled();
    await app.user.click(within(card).getByTestId("request-matched"));
    await app.user.click(approve);
    await waitFor(() => expect(fake.find("post", `/admin/activation/requests/${R.id}/approve`)).toHaveLength(1));
    expect(fake.find("post", `/admin/activation/requests/${R.id}/approve`)[0]!.body).toEqual({ sentAt: R.sentAt });
    expect(await screen.findByText(t("admin.activation.requests.verified", { name: "سارة مزيان" }))).toBeInTheDocument();
  });

  it("الرفض بلا سبب ⇒ لا؛ وبسببه ⇒ يُرسل معه", async () => {
    const { app, card } = await requests();
    await app.user.click(within(card).getByTestId("request-refuse"));
    const confirm = within(card).getByTestId("request-refuse-confirm");
    expect(confirm).toBeDisabled();
    await app.user.type(within(card).getByTestId("request-reason"), "الوجه غير واضح.");
    await app.user.click(confirm);
    await waitFor(() => expect(fake.find("post", `/admin/activation/requests/${R.id}/reject`)).toHaveLength(1));
    expect(fake.find("post", `/admin/activation/requests/${R.id}/reject`)[0]!.body).toEqual({ sentAt: R.sentAt, reason: "الوجه غير واضح." });
  });

  it("أُعيد الإرسال بعد ما رُئي ⇒ رسالة الخادم", async () => {
    fake.fail("post", "/admin/activation/requests/:id/approve", 409, "أعاد الطالب إرسال صوره للتوّ — راجِع الصور الجديدة ثمّ قرّر.");
    const { app, card } = await requests();
    await app.user.click(within(card).getByTestId("request-matched"));
    await app.user.click(within(card).getByTestId("request-approve"));
    expect(await within(card).findByText("أعاد الطالب إرسال صوره للتوّ — راجِع الصور الجديدة ثمّ قرّر.")).toBeInTheDocument();
  });

  it("لا طلبات ⇒ يُقال؛ و«مكتب التفعيل» جزءٌ يسكن الرابط", async () => {
    fake.empty = true;
    const app = renderApp("/ar/admin/users?view=requests", { as: "admin" });
    expect(await screen.findByTestId("requests-empty")).toHaveTextContent(t("admin.activation.requests.empty"));
    await app.user.click(screen.getByTestId("users-view-desk"));
    expect(await screen.findByTestId("desk-input")).toBeInTheDocument();
    expect(app.location()).toContain("view=desk");
  });
});

describe("طلبٌ وصل بلا صور قبل أن تُشترط", () => {
  it("يُقال «بلا صور»، ومكان البطاقة «لم تُرسل»، ولا يُطلب شيء؛ والعلامة علامة تحقّقٍ آخر", async () => {
    fake.on("get", "/admin/activation/requests", { items: [{ ...R, qrNumber: null, qrMatches: null, photos: { card: false, selfie: false } }], total: 1 });
    const { app, card } = await requests();
    expect(within(card).getByText(t("admin.activation.requests.noPhotos"))).toBeInTheDocument();
    // The card's place alone: the card is all that is asked for now.
    expect(within(card).getAllByTestId("request-no-photo")).toHaveLength(1);
    expect(fake.find("get", /\/admin\/activation\/requests\/.+\/(card|selfie)$/)).toHaveLength(0);
    expect(within(card).getByText(t("admin.activation.requests.identityLabel"))).toBeInTheDocument();
    await app.user.click(within(card).getByTestId("request-matched"));
    await app.user.click(within(card).getByTestId("request-approve"));
    await waitFor(() => expect(fake.find("post", `/admin/activation/requests/${R.id}/approve`)).toHaveLength(1));
  });

  it("طلبٌ بصورتين سبق التغيير ⇒ تُعرضان، ويُقارن الوجه بالبطاقة", async () => {
    fake.on("get", "/admin/activation/requests", { items: [{ ...R, photos: { card: true, selfie: true } }], total: 1 });
    const { card } = await requests();
    expect(await within(card).findByTestId("request-photo-card")).toBeInTheDocument();
    expect(await within(card).findByTestId("request-photo-selfie")).toBeInTheDocument();
    expect(card).toHaveTextContent(t("admin.activation.requests.matchLabel"));
  });
});

/**
 * كلّ طلبٍ يُطوى: الأوّل مفتوح والبقيّة رؤوسٌ — من هو، وما قيل في رمز بطاقته،
 * ومتى أرسل. وصورتا المطويّ لا تُجلبان حتى يُفتح؛ وما عُلّم أو كُتب فيه لا
 * يضيع إذا طُوي.
 */
describe("الطلبات تُطوى", () => {
  const second = { ...R, id: "request-student-2", registrationNumber: "777000444", firstName: "مراد", lastName: "سعدي", firstNameLatin: "Mourad", lastNameLatin: "SAADI", sentAt: "2026-11-01T09:00:00.000Z" };
  const toggle = (card: HTMLElement) => within(card).getByTestId("request-toggle");

  it("الأوّل مفتوح، والثاني مطويّ بلا جلب صوره — حتى يُفتح، ثمّ يُطوى", async () => {
    fake.on("get", "/admin/activation/requests", { items: [R, second], total: 2 });
    const app = renderApp("/ar/admin/users?view=requests", { as: "admin" });
    const [first, other] = await screen.findAllByTestId("activation-request");
    expect(toggle(first!)).toHaveAttribute("aria-expanded", "true");
    expect(await within(first!).findByTestId("request-photo-card")).toBeInTheDocument();

    // Folded: who and what, no photos fetched, nothing to decide.
    expect(toggle(other!)).toHaveAttribute("aria-expanded", "false");
    expect(other).toHaveTextContent("مراد سعدي");
    expect(other).toHaveTextContent(t("admin.activation.requests.qrMatch"));
    expect(within(other!).queryByTestId("request-approve")).toBeNull();
    expect(fake.find("get", `/admin/activation/requests/${second.id}/card`)).toHaveLength(0);

    await app.user.click(toggle(other!));
    expect(toggle(other!)).toHaveAttribute("aria-expanded", "true");
    expect(await within(other!).findByTestId("request-photo-card")).toBeInTheDocument();
    expect(fake.find("get", `/admin/activation/requests/${second.id}/card`)).toHaveLength(1);

    await app.user.click(toggle(first!));
    expect(toggle(first!)).toHaveAttribute("aria-expanded", "false");
    expect(within(first!).queryByTestId("request-body")).toBeNull();
  });

  it("ما عُلّم قبل الطيّ يبقى بعد الفتح", async () => {
    const { app, card } = await requests();
    await app.user.click(within(card).getByTestId("request-matched"));
    await app.user.click(toggle(card));
    await app.user.click(toggle(card));
    expect(within(card).getByTestId("request-matched")).toBeChecked();
    expect(within(card).getByTestId("request-approve")).toBeEnabled();
  });

  it("«افتح الكلّ» ثمّ «اطوِ الكلّ»", async () => {
    fake.on("get", "/admin/activation/requests", { items: [R, second], total: 2 });
    const app = renderApp("/ar/admin/users?view=requests", { as: "admin" });
    const cards = await screen.findAllByTestId("activation-request");
    const foldAll = screen.getByTestId("requests-fold-all");
    expect(foldAll).toHaveTextContent(t("admin.activation.requests.expandAll"));
    await app.user.click(foldAll);
    for (const c of cards) expect(toggle(c)).toHaveAttribute("aria-expanded", "true");
    expect(foldAll).toHaveTextContent(t("admin.activation.requests.collapseAll"));
    await app.user.click(foldAll);
    for (const c of cards) expect(toggle(c)).toHaveAttribute("aria-expanded", "false");
  });

  it("طلبٌ واحد: لا زرّ لطيّ الكلّ", async () => {
    await requests();
    expect(screen.queryByTestId("requests-fold-all")).toBeNull();
  });
});

describe("فلتر الطلبات، والملف الكامل في الصفحة نفسها", () => {
  const two = [R, { ...R, id: "request-student-2", registrationNumber: "777000444", firstName: "مراد", lastName: "سعدي", firstNameLatin: "Mourad", lastNameLatin: "SAADI", photos: { card: false, selfie: false }, qrMatches: null, qrNumber: null, sentAt: "2026-11-01T07:00:00.000Z" }];

  it("بالاسم، وبرمز البطاقة — والعدد يقول كم بقي", async () => {
    fake.on("get", "/admin/activation/requests", { items: two, total: 2 });
    const app = renderApp("/ar/admin/users?view=requests", { as: "admin" });
    expect(await screen.findAllByTestId("activation-request")).toHaveLength(2);
    expect(screen.getByTestId("requests-shown")).toHaveTextContent(t("admin.activation.requests.filter.shown", { shown: 2, total: 2 }));

    await app.user.type(screen.getByTestId("requests-search"), "مراد");
    expect(screen.getAllByTestId("activation-request")).toHaveLength(1);
    await app.user.clear(screen.getByTestId("requests-search"));

    // The card's QR code read as this account's: only the request that has it.
    await app.user.click(screen.getByRole("combobox", { name: t("admin.activation.requests.filter.qr") }));
    await app.user.click(await screen.findByRole("option", { name: new RegExp(t("admin.activation.requests.filter.qrs.match")) }));
    expect(screen.getAllByTestId("activation-request")).toHaveLength(1);
    expect(screen.getByTestId("activation-request")).toHaveTextContent("سارة مزيان");
    await app.user.type(screen.getByTestId("requests-search"), "لا أحد");
    expect(screen.getByTestId("requests-no-match")).toBeInTheDocument();
  });

  it("«الملف الكامل» ⇒ ملفّ الطالب فوق الصفحة، ويُغلق", async () => {
    const { app, card } = await requests();
    await app.user.click(within(card).getByTestId("request-profile"));
    const drawer = await screen.findByTestId("profile-drawer");
    expect(await within(drawer).findByTestId("student-profile")).toHaveTextContent(F.studentProfile.academic.faculty);
    expect(fake.find("get", `/admin/activation/students/${R.id}`)).toHaveLength(1);
    await app.user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("profile-drawer")).toBeNull());
  });
});
