import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import i18n from "../../../i18n/i18n";
import { fake } from "../../../test/fake-api";
import { FakeSocket } from "../../../test/fake-socket";
import { renderApp } from "../../../test/render-app";
import * as F from "../../../test/fixtures";

/**
 * جرس الرسائل في رأس اللوحات.
 *
 * يُحرس: أنّ عليه عدد ما لم يُقرأ، ولا عدد حين لا شيء؛ وأنّه يُفتح على آخر
 * الرسائل — ونقرةُ رسالةٍ تقود إلى محادثة مرسلها — ويُغلق بـEsc؛ وأنّ «تعليم
 * الكلّ كمقروء» يصل الخادم؛ وأنّه في لوحات الأدوار كلّها.
 */
const t = (k: string, o?: object) => String(i18n.t(k, o as never));

let socket: FakeSocket;
beforeEach(() => {
  fake.reset();
  localStorage.clear();
  socket = new FakeSocket();
});

describe("جرس الرسائل", () => {
  it("عليه عدد ما لم يُقرأ؛ ويُفتح على آخر الرسائل، ونقرةُ واحدةٍ تقود إلى محادثة مرسلها", async () => {
    const app = renderApp("/ar/student", { as: "student", socket });
    const bell = await screen.findByTestId("message-bell");
    expect(await screen.findByTestId("message-bell-count")).toHaveTextContent("1");
    expect(bell).toHaveAccessibleName(t("msg.bell.aria", { count: 1 }));

    await app.user.click(bell);
    expect(bell).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByTestId("message-bell-list");
    expect(await within(list).findByText("موعد الإشراف")).toBeInTheDocument();
    expect(within(list).getByText("إعلان")).toBeInTheDocument();

    await app.user.click(within(list).getByText("موعد الإشراف"));
    await waitFor(() => expect(app.location()).toBe(`/ar/student/messages?c=${F.profUsers[0]!.id}`));
    expect(bell).toHaveAttribute("aria-expanded", "false");
  });

  it("«تعليم الكلّ كمقروء» يصل الخادم؛ وEsc يُغلقه", async () => {
    const app = renderApp("/ar/admin", { as: "admin", socket });
    const bell = await screen.findByTestId("message-bell");
    await screen.findByTestId("message-bell-count");
    await app.user.click(bell);
    await app.user.click(await screen.findByTestId("message-bell-read-all"));
    await waitFor(() => expect(fake.find("patch", "/messages/read-all")).toHaveLength(1));
    await app.user.keyboard("{Escape}");
    expect(bell).toHaveAttribute("aria-expanded", "false");
  });

  it("لا رسائل ⇒ لا عدد، والجرس مفتوحاً يقول ذلك", async () => {
    fake.empty = true;
    const app = renderApp("/ar/professor", { as: "professor", socket });
    const bell = await screen.findByTestId("message-bell");
    expect(screen.queryByTestId("message-bell-count")).toBeNull();
    await app.user.click(bell);
    expect(await within(screen.getByTestId("message-bell-panel")).findByText(t("msg.bell.empty"))).toBeInTheDocument();
  });
});
