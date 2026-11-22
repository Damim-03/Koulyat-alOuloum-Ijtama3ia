import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "../../../../i18n/i18n";
import { fake, installFakeApi } from "../../../../test/fake-api";
import { CoverImageField } from "./cover-image-field";

/**
 * صورة الغلاف أو الشعار: تُرفع لحظة اختيارها، والاستمارة لا تحمل إلّا رابطها.
 *
 * يُحرس: أنّ ما فوق ٢ ميغابايت يُرفض قبل الرفع بسببه؛ وأنّ السحب والإفلات
 * كالاختيار؛ وأنّ الصورة المحفوظة تُستبدل وتُزال؛ وأنّ صورةً لا تُحمَّل يُقال
 * عنها ذلك.
 */
const t = (k: string) => String(i18n.t(k));

function Host({ initial = "", variant }: { initial?: string; variant?: "cover" | "icon" }) {
  const [url, setUrl] = useState(initial);
  return (
    <>
      <CoverImageField value={url} onChange={setUrl} variant={variant} />
      <output data-testid="url">{url}</output>
    </>
  );
}
function setup(props: Parameters<typeof Host>[0] = {}) {
  installFakeApi();
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const user = userEvent.setup({ delay: null });
  const view = render(
    <QueryClientProvider client={qc}>
      <Host {...props} />
    </QueryClientProvider>,
  );
  return { user, view, url: () => screen.getByTestId("url").textContent, input: () => view.container.querySelector('input[type="file"]') as HTMLInputElement };
}
const png = (size = 10) => new File([new Uint8Array(size)], "c.png", { type: "image/png" });

beforeEach(() => fake.reset());

describe("صورة الغلاف", () => {
  it("المنطقة الفارغة تفتح الاختيار؛ والسحب والإفلات يرفعان", async () => {
    const { user, url, input, view } = setup();
    const picked = vi.spyOn(input(), "click").mockImplementation(() => {});
    const zone = view.container.querySelector("button") as HTMLButtonElement;
    await user.click(zone);
    expect(picked).toHaveBeenCalled();

    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [png()] } });
    await waitFor(() => expect(fake.find("post", "/admin/uploads/image")).toHaveLength(1));
    await waitFor(() => expect(url()).toBe("/uploads/cards/new.jpg"));
  });

  it("ما فوق ٢ ميغابايت يُرفض بسببه ولا يُرفع", async () => {
    const { input } = setup();
    fireEvent.change(input(), { target: { files: [png(2 * 1024 * 1024 + 1)] } });
    expect(await screen.findByText(t("admin.coverTooLarge"))).toBeInTheDocument();
    expect(fake.find("post", "/admin/uploads/image")).toEqual([]);
  });

  it("المحفوظة تُستبدل وتُزال بأيقونتيهما؛ وشعارٌ لا يُحمَّل يُقال عنه", async () => {
    const { user, url, input, view } = setup({ initial: "/uploads/cards/old.jpg", variant: "icon" });
    const picked = vi.spyOn(input(), "click").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: t("admin.replaceIcon") }));
    expect(picked).toHaveBeenCalled();
    fireEvent.error(view.container.querySelector("img")!);
    expect(await screen.findByText(t("admin.coverBroken"))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t("admin.removeIcon") }));
    expect(url()).toBe("");
  });
});
