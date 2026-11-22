import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../../../../i18n/i18n";
import { fake, installFakeApi } from "../../../../test/fake-api";
import { SignInCheck } from "./signin-check";

/**
 * درجة الصورة من تحقّق الدخول — في نافذة المنصّة لا في فقاعة الأداة.
 *
 * يُحرس: أنّ النافذة تنفتح وحدها حين يُنتظر الدخول؛ وأنّ الرمز يُرسل مع حلّ
 * المسألة؛ وأنّ الرمز الخاطئ يُقال بسببه وتأتي صورةٌ جديدة؛ وأنّ الأرقام
 * المكتوبة بلوحة مفاتيحٍ عربية (٢٣٤٥٦) تُقرأ أرقاماً؛ وأنّ «إلغاء» يُلغي
 * الدخول المنتظَر.
 *
 * المسألة الحسابية تُحلّ في المتصفّح (WebCrypto) وjsdom ليس متصفّحاً، فحلّها
 * هنا بديلٌ ثابت — والخادم يُختبَر بحلولٍ حقيقية في Backend tests/api/auth-captcha.
 */
vi.mock("../../lib/solve-work", () => ({ solveWork: async () => "WORK-PAYLOAD" }));

const t = (k: string) => String(i18n.t(k));

function setup(waiting = true) {
  installFakeApi();
  const onVerified = vi.fn();
  const onCancel = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup({ delay: null });
  render(
    <QueryClientProvider client={qc}>
      <SignInCheck level="image" onVerified={onVerified} onReset={() => {}} onCancel={onCancel} waiting={waiting} />
    </QueryClientProvider>,
  );
  return { user, onVerified, onCancel };
}

beforeEach(() => fake.reset());

describe("رمز الصورة في نافذة المنصّة", () => {
  it("الدخول ينتظر ⇒ النافذة تنفتح بالصورة؛ والرمز الصحيح يُرسل مع حلّ المسألة ويعطي التصريح", async () => {
    const { user, onVerified } = setup();
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(t("auth.captcha.dialogTitle"))).toBeInTheDocument();
    expect(await within(dialog).findByTestId("image-code-picture")).toHaveAttribute("src", "data:image/svg+xml;base64,PHN2Zy8+");

    const verifyButton = within(dialog).getByTestId("image-verify");
    expect(verifyButton).toBeDisabled();
    await user.type(within(dialog).getByTestId("image-code"), "23456");
    await user.click(verifyButton);

    await waitFor(() => expect(onVerified).toHaveBeenCalledWith("PASS-1"));
    expect(fake.find("post", "/auth/challenge/verify")[0]!.body).toEqual({ payload: "WORK-PAYLOAD", code: "23456" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByText(t("auth.captcha.passed"))).toBeInTheDocument();
  });

  it("رمزٌ خاطئ ⇒ سببه، وصورةٌ جديدة بحقلٍ فارغ", async () => {
    const { user, onVerified } = setup();
    const dialog = await screen.findByRole("alertdialog");
    await within(dialog).findByTestId("image-code-picture");
    await user.type(within(dialog).getByTestId("image-code"), "99999");
    await user.click(within(dialog).getByTestId("image-verify"));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("الرمز لا يطابق الصورة");
    await waitFor(() => expect(fake.find("get", "/auth/challenge")).toHaveLength(2));
    expect(within(dialog).getByTestId("image-code")).toHaveValue("");
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("أرقامٌ عربية ⇒ تُقرأ أرقاماً، وما ليس رقماً يُحذف", async () => {
    const { user } = setup();
    const dialog = await screen.findByRole("alertdialog");
    await within(dialog).findByTestId("image-code-picture");
    await user.type(within(dialog).getByTestId("image-code"), "٢٣a٤٥٦");
    expect(within(dialog).getByTestId("image-code")).toHaveValue("23456");
  });

  it("«صورة أخرى» تطلب غيرها؛ و«إلغاء» يُغلق ويُلغي الدخول المنتظَر", async () => {
    const { user, onCancel } = setup();
    const dialog = await screen.findByRole("alertdialog");
    await within(dialog).findByTestId("image-code-picture");
    await user.click(within(dialog).getByRole("button", { name: t("auth.captcha.newImage") }));
    await waitFor(() => expect(fake.find("get", "/auth/challenge")).toHaveLength(2));

    await user.click(within(dialog).getByRole("button", { name: t("auth.captcha.cancel") }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("الدخول لا ينتظر ⇒ لا نافذة حتى يُضغط الزرّ", async () => {
    const { user } = setup(false);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(screen.getByTestId("image-check-start"));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });
});
