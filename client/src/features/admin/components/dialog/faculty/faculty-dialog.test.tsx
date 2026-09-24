/**
 * نافذة الكلّية — الصورتان.
 *
 * الغلاف والشعار لا يُسجَّلان بـ`register`: يُرفع الملفّ وحده ثمّ يُوضع
 * رابطه بـ`setValue` في حقلٍ لا عنصر له في الصفحة. وذلك موضعٌ يسهل أن ينكسر
 * بلا صوت — النافذة تعمل، والحفظ ينجح، والصورة وحدها لا تصل. فيسأل هذا
 * الملفّ عن الحمولة المُرسَلة لا عن الشكل:
 *
 *   ١. أن يصل الرابط المرفوع إلى ما يُحفظ؛
 *   ٢. أن تصل السلسلة الفارغة عند الحذف — فبها يُمسح العمود؛
 *   ٣. أن تُملأ النافذة بما هو محفوظ عند التعديل، وإلّا بدا المحفوظ مفقوداً.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("i18next", () => ({ t: (key: string) => key }));

const create = { mutate: vi.fn(), isPending: false };
const update = { mutate: vi.fn(), isPending: false };

/** الرفع ينجح دائماً هنا: المقصود ما يقع بعده. */
const UPLOADED = "/uploads/cards/11111111-2222-3333-4444-555555555555.png";
const upload = {
  mutate: vi.fn((_f: unknown, o?: { onSuccess?: (url: string) => void }) =>
    o?.onSuccess?.(UPLOADED),
  ),
  isPending: false,
};

vi.mock("../../../hooks/admin-hook", () => ({
  useCreateFaculty: () => create,
  useUpdateFaculty: () => update,
  useFaculties: () => ({ data: [] }),
  useUploadImage: () => upload,
}));

const { FacultyFormDialog } = await import("./faculty-dialog.form");

const file = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "c.png", {
    type: "image/png",
  });

/** حقول الملفّ مخفيّة، فتُلتقط من الـDOM لا بدورٍ أو نصّ. */
const fileInputs = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="file"]'),
  );

beforeEach(() => {
  create.mutate.mockClear();
  update.mutate.mockClear();
  upload.mutate.mockClear();
});

const FACULTY = {
  id: "f1",
  name: "كلية العلوم",
  // رمزٌ مصكوكٌ على الشكل الجديد: موضوع هذا الملفّ الصورتان، والرمزُ
  // القديم يُستبدل عند التعديل — وله اختباره في حوار القسم.
  code: "F-1789412345678",
  coverUrl: "/uploads/cards/cover.png",
  iconUrl: "/uploads/cards/icon.png",
};

describe("نافذة الكلّية", () => {
  /**
   * الرفع يُبدّل الصورة ويصل رابطها إلى ما يُحفظ.
   *
   * والنافذة تُفتح على كلّيةٍ قائمة لا فارغة، لأنّ الكتابة اليدوية في بيئة
   * jsdom لا تصل إلى `react-hook-form` حين تُهيَّأ القيم بـ`reset` داخل أثر
   * — تصرّفٌ لا يقع في المتصفّح (الأسماء تُحفظ فعلاً)، ولا علاقة له
   * بالصورتين. فيُسأل هنا عمّا يخصّ الصورتين وحده.
   */
  it("ترفع الغلاف والشعار وتُرسل رابطيهما مع الحفظ", async () => {
    const user = userEvent.setup();
    render(<FacultyFormDialog open onClose={() => {}} faculty={FACULTY} />);

    const [cover, icon] = fileInputs();
    await user.upload(cover!, file());
    await user.upload(icon!, file());

    await user.click(screen.getByText("admin.saveData"));

    await waitFor(() => expect(update.mutate).toHaveBeenCalled());
    const { data } = update.mutate.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).toMatchObject({
      name: "كلية العلوم",
      code: FACULTY.code,
      coverUrl: UPLOADED,
      iconUrl: UPLOADED,
    });
  });

  it("وتُملأ بما هو محفوظ عند التعديل", () => {
    render(
      <FacultyFormDialog
        open
        onClose={() => {}}
        faculty={{
          id: "f1",
          name: "كلية العلوم",
          code: "FSC",
          coverUrl: "/uploads/cards/cover.png",
          iconUrl: "/uploads/cards/icon.png",
        }}
      />,
    );

    const srcs = Array.from(document.querySelectorAll("img")).map((i) => i.src);
    expect(srcs.some((s) => s.endsWith("/uploads/cards/cover.png"))).toBe(true);
    expect(srcs.some((s) => s.endsWith("/uploads/cards/icon.png"))).toBe(true);
  });

  /**
   * الحذف يُرسل سلسلةً فارغة — وهي التي يترجمها الخادم إلى `null`. ولو أُرسل
   * `undefined` لما مُسّ العمود، فتبقى الصورة بعد حذفها.
   */
  it("وحذفُ الصورة يُرسل سلسلةً فارغة لا يتركها كما هي", async () => {
    const user = userEvent.setup();
    render(
      <FacultyFormDialog
        open
        onClose={() => {}}
        faculty={{
          id: "f1",
          name: "كلية العلوم",
          code: "FSC",
          coverUrl: "/uploads/cards/cover.png",
          iconUrl: "/uploads/cards/icon.png",
        }}
      />,
    );

    // زرّا الحذف — واحدٌ لكل صورة، يُلتقطان باسميهما لا بصنفهما اللوني.
    const removes = [
      screen.getByRole("button", { name: "admin.removeCover" }),
      screen.getByRole("button", { name: "admin.removeIcon" }),
    ];

    for (const b of removes) await user.click(b);
    await user.click(screen.getByText("admin.saveData"));

    await waitFor(() => expect(update.mutate).toHaveBeenCalled());
    const { data } = update.mutate.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data.coverUrl).toBe("");
    expect(data.iconUrl).toBe("");
  });
});
