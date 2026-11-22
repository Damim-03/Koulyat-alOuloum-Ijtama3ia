import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "../../../../i18n/i18n";
import { ImageCropperDialog } from "./image-cropper-dialog";

/**
 * قصّ الصورة قبل رفعها: إطارٌ ثابت (280×360) والصورة تُسحب تحته وتُكبَّر.
 *
 * يُحرس: أنّ الصورة لا تُكشف عنها زاويةٌ فارغة مهما سُحبت (تُحصر في حدودها)؛
 * وأنّ التكبير بين ١ و٣ لا يتجاوزهما؛ وأنّ «إعادة الضبط» تعيد كلّ شيء؛
 * وأنّ التأكيد يُخرج ملفّ JPEG، والإلغاء لا يُخرج شيئاً.
 *
 * صورة الاختبار ١٦٠٠×١٢٠٠ (من image-stub): تغطّي الإطار بمقياس ٠٫٣، فعرضها
 * ٤٨٠ — تتحرّك أفقياً ١٠٠ إلى كلّ جهة، ولا تتحرّك عمودياً.
 */
const t = (k: string) => String(i18n.t(k));

function setup() {
  const onDone = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup({ delay: null });
  render(<ImageCropperDialog open file={new File(["png"], "me.png", { type: "image/png" })} onDone={onDone} onCancel={onCancel} />);
  const img = () => document.querySelector("img") as HTMLImageElement;
  const zoom = () => screen.getByRole("slider", { name: t("admin.zoom") }) as HTMLInputElement;
  return { user, onDone, onCancel, img, zoom };
}

describe("قصّ الصورة", () => {
  it("السحب يحرّك الصورة داخل حدودها فقط", async () => {
    const { user, img } = setup();
    await waitFor(() => expect(img().style.width).toBe("480px"));
    expect(img().style.left).toBe("-100px");
    const stage = img().parentElement!;

    await user.pointer([{ keys: "[MouseLeft>]", target: stage, coords: { clientX: 100, clientY: 100 } }, { coords: { clientX: 400, clientY: 300 } }]);
    expect(img().style.left).toBe("0px");
    expect(img().style.top).toBe("0px");
    await user.pointer([{ coords: { clientX: -400, clientY: 100 } }, { keys: "[/MouseLeft]" }]);
    expect(img().style.left).toBe("-200px");
    // بعد الإفلات لا يحرّكها المرور.
    await user.pointer({ target: stage, coords: { clientX: 300, clientY: 100 } });
    expect(img().style.left).toBe("-200px");
  });

  it("التكبير بزرّيه وبالمنزلق بين ١ و٣، و«إعادة الضبط» تعيد الحجم والموضع", async () => {
    const { user, img, zoom } = setup();
    await waitFor(() => expect(img().style.width).toBe("480px"));
    await user.click(screen.getByRole("button", { name: t("admin.zoomIn") }));
    expect(Number(zoom().value)).toBeCloseTo(1.2);
    expect(img().style.width).toBe("576px");
    await user.click(screen.getByRole("button", { name: t("admin.zoomOut") }));
    await user.click(screen.getByRole("button", { name: t("admin.zoomOut") }));
    expect(zoom().value).toBe("1");

    const stage = img().parentElement!;
    await user.pointer([{ keys: "[MouseLeft>]", target: stage, coords: { clientX: 100, clientY: 100 } }, { coords: { clientX: 400, clientY: 100 } }, { keys: "[/MouseLeft]" }]);
    expect(img().style.left).toBe("0px");
    // تصغيرٌ بعد السحب يعيد حصرها: لا زاوية فارغة.
    await user.click(screen.getByRole("button", { name: t("admin.zoomIn") }));
    await user.click(screen.getByRole("button", { name: t("admin.zoomOut") }));
    expect(img().style.left).toBe("0px");

    await user.click(screen.getByTitle(t("admin.resetCrop")));
    expect(zoom().value).toBe("1");
    expect(img().style.left).toBe("-100px");
  });

  it("التأكيد يُخرج ملفّ JPEG؛ والإغلاق من الرأس ومن الخلفية ومن «إلغاء» لا يُخرج شيئاً", async () => {
    const { user, img, onDone, onCancel } = setup();
    await waitFor(() => expect(img().style.width).toBe("480px"));
    await user.click(screen.getByRole("button", { name: t("admin.close") }));
    await user.click(document.querySelector(".backdrop-blur-sm") as HTMLElement);
    await user.click(screen.getByRole("button", { name: t("pro.cancel") }));
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onDone).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: new RegExp(t("admin.confirmImage")) }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const out = onDone.mock.calls[0]![0] as File;
    expect(out.type).toBe("image/jpeg");
    expect(out.name).toMatch(/^photo-\d+\.jpg$/);
  });
});
