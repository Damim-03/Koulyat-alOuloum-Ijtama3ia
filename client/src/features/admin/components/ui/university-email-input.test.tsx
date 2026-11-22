import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../../../../i18n/i18n";
import { fake, installFakeApi } from "../../../../test/fake-api";
import { UniversityEmailInput } from "./university-email-input";

/**
 * عنوان الأستاذ الجامعيّ: نصفٌ قبل «@» يُكتب أو يُقترح من اسمه، ونطاقٌ
 * بعدها يُختار من نطاقات الجامعة أو يُضاف إليها.
 *
 * يُحرس: أنّ الاسم العربيّ يُقترح بكتابته اللاتينية المعتادة (المعروف منه
 * بتهجئته، وغيره بقواعد تُدرج الحركات)، وأنّ لصق عنوانٍ كامل يملأ نصفيه،
 * وأنّ ما لا يقبله الخادم من حروفٍ يُحذف، وأنّ نطاقاً اختير قبل كتابة
 * الاسم لا يرتدّ إلى الافتراضيّ.
 */
const t = (k: string) => String(i18n.t(k));

function Host(props: { firstName?: string; lastName?: string; initial?: string }) {
  const [value, setValue] = useState(props.initial ?? "");
  return (
    <>
      <UniversityEmailInput value={value} onChange={setValue} firstName={props.firstName} lastName={props.lastName} />
      <output data-testid="value">{value}</output>
    </>
  );
}

function setup(props: Parameters<typeof Host>[0] = {}) {
  installFakeApi();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const user = userEvent.setup({ delay: null });
  render(
    <QueryClientProvider client={qc}>
      <Host {...props} />
    </QueryClientProvider>,
  );
  const value = () => screen.getByTestId("value").textContent;
  const menu = () => screen.getByRole("button", { name: t("admin.emailShapesAndDomains") });
  return { user, value, menu, local: () => screen.getByPlaceholderText("prof") };
}

beforeEach(() => {
  fake.reset();
  i18n.changeLanguage("ar");
});

describe("الاقتراحات من الاسم", () => {
  it("اسمٌ معروف بتهجئته: أربعة أشكال على النطاق الافتراضيّ، والمختار يُملأ", async () => {
    const { user, value, menu } = setup({ firstName: "كريم", lastName: "مرابط" });
    await user.click(menu());
    await screen.findByText("@univ-alger.dz", { selector: "button span" });
    const shapes = ["karim.merabet", "k.merabet", "merabet.karim", "kmerabet"];
    for (const s of shapes) expect(screen.getByText(`${s}@univ-msila.dz`)).toBeInTheDocument();
    await user.click(screen.getByText("k.merabet@univ-msila.dz"));
    expect(value()).toBe("k.merabet@univ-msila.dz");
    expect(menu()).toHaveAttribute("aria-expanded", "false");
  });

  it("اسمٌ غير معروف: الياء الأولى «y»، وبين ساكنين «e»", async () => {
    const { user, menu } = setup({ firstName: "يونس", lastName: "بوزيد" });
    await user.click(menu());
    expect(await screen.findByText(/^younes\.bouzid@/)).toBeInTheDocument();
  });

  it("اللقب وحده يُقترح وحده، واللاتينيّ يُصغَّر", async () => {
    const one = setup({ lastName: "Haddad" });
    await one.user.click(one.menu());
    await screen.findByText("@univ-alger.dz", { selector: "button span" });
    const items = await screen.findAllByText(/@univ-msila\.dz$/, { selector: "span" });
    expect(items.map((i) => i.textContent)).toContain("haddad@univ-msila.dz");
    expect(screen.queryByText(/\.haddad@/)).toBeNull();
  });

  it("بلا اسمٍ ولا لقب ⇒ تلميحٌ بدل الأشكال", async () => {
    const { user, menu } = setup();
    await user.click(menu());
    expect(screen.getByText(t("admin.suggestedShapesHint"))).toBeInTheDocument();
  });
});

describe("الكتابة والنطاق", () => {
  it("لصق عنوانٍ كامل يملأ نصفيه، والحروف غير المقبولة تُحذف", async () => {
    const { user, value, local } = setup();
    await user.click(local());
    await user.paste("s.ali@univ-alger.dz");
    expect(value()).toBe("s.ali@univ-alger.dz");
    expect(screen.getByText("@univ-alger.dz")).toBeInTheDocument();

    await user.clear(local());
    await user.type(local(), "a b!ج");
    expect(value()).toBe("ab@univ-alger.dz");
  });

  it("نطاقٌ يُختار قبل الاسم يبقى، ثمّ يُلحق بما يُكتب", async () => {
    const { user, value, menu, local } = setup();
    await user.click(menu());
    await user.click(await screen.findByText("@univ-alger.dz", { selector: "button span" }));
    expect(value()).toBe("");
    expect(screen.getByText("@univ-alger.dz")).toBeInTheDocument();
    await user.type(local(), "nadia");
    expect(value()).toBe("nadia@univ-alger.dz");
  });

  it("Escape والنقر خارج القائمة يغلقانها", async () => {
    const { user, menu } = setup();
    await user.click(menu());
    await user.keyboard("{Escape}");
    expect(menu()).toHaveAttribute("aria-expanded", "false");
    await user.click(menu());
    await user.pointer({ keys: "[MouseLeft]", target: document.querySelector(".fixed.inset-0")! });
    expect(menu()).toHaveAttribute("aria-expanded", "false");
  });

  it("نطاقٌ جديد يُضاف بحروفه الصغيرة فيُختار؛ و«إلغاء» يطوي الإضافة", async () => {
    const { user, value, menu, local } = setup({ initial: "rachid@univ-msila.dz" });
    await user.click(menu());
    await user.click(await screen.findByRole("button", { name: t("admin.addUniversityDomain") }));
    await user.type(screen.getByPlaceholderText(t("admin.domainPlaceholder")), "Univ Test.DZ");
    await user.click(screen.getByRole("button", { name: t("admin.cancelShort") }));
    expect(screen.queryByPlaceholderText(t("admin.domainPlaceholder"))).toBeNull();

    await user.click(screen.getByRole("button", { name: t("admin.addUniversityDomain") }));
    const draft = screen.getByPlaceholderText(t("admin.domainPlaceholder"));
    expect(screen.getByRole("button", { name: t("admin.add") })).toBeDisabled();
    await user.type(draft, "@Univ-Test.DZ{Enter}");
    await waitFor(() => expect(fake.find("post", "/admin/university-domains")[0]?.body).toEqual({ domain: "univ-test.dz" }));
    await waitFor(() => expect(value()).toBe("rachid@univ-test.dz"));
    expect(local()).toHaveValue("rachid");
  });

  it("حذف نطاقٍ يُطلب باسمه", async () => {
    const { user, menu } = setup();
    await user.click(menu());
    const row = (await screen.findByText("@univ-alger.dz", { selector: "button span" })).closest("li")!;
    await user.click(within(row).getByRole("button", { name: t("admin.deleteDomain") }));
    await waitFor(() => expect(fake.find("delete", "/admin/university-domains/ud2")).toHaveLength(1));
  });
});
