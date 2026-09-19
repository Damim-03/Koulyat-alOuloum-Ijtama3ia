/**
 * توثيق حسابٍ قائم من صفحة تفاصيله.
 *
 * الطرف الآخر مُختبَرٌ في الخلفية: المسار يرفع التوثيق ويسحبه، ويردّ ٤٠٣
 * على الطالب والأستاذ. وما لا يجيب عنه اختبارُ خادمٍ هو **هل يصل الزرّ
 * إليه أصلاً** — وبأيّ قيمة. فصفحةٌ تعرض زرّاً يفتح نافذةً لا تستدعي شيئاً
 * تبدو عاملةً تماماً.
 *
 * ولذلك يؤكّد هذا الملفّ سلسلةً واحدة: زرّ ⇐ تأكيد ⇐ نداءٌ بالقيمة
 * المعكوسة — لا شكل الصفحة ولا نصوصها.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDetail } from "../../../../types/admin";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("i18next", () => ({ t: (key: string) => key }));
vi.mock("../../../../i18n/i18n", () => ({
  default: { language: "ar", t: (key: string) => key },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "u-1", lang: "ar" }),
}));

// النوافذ المخصّصة بالدور تجرّ استمارات كاملة لا شأن لها بالتوثيق.
vi.mock("../../components/dialog/student/student-edit-dialog.form", () => ({
  StudentEditDialog: () => null,
}));
vi.mock("../../components/dialog/professor/professor-edit-dialog.form", () => ({
  ProfessorEditDialog: () => null,
}));

const user: UserDetail = {
  id: "u-1",
  firstName: "سارة",
  lastName: "بن علي",
  email: "sara@test.local",
  username: "sara",
  avatarUrl: null,
  gender: "female",
  phone: null,
  role: "admin",
  status: "active",
  isVerified: false,
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  student: null,
  professor: null,
};

const setVerification = { mutate: vi.fn(), isPending: false };
const idle = { mutate: vi.fn(), isPending: false };
let current: UserDetail = user;

vi.mock("../../hooks/admin-hook", () => ({
  useUser: () => ({ data: current, isLoading: false, refetch: vi.fn() }),
  useUpdateUser: () => idle,
  useProfessor: () => ({ data: null, refetch: vi.fn() }),
  useStudent: () => ({ data: null, refetch: vi.fn() }),
  useResetUserPassword: () => idle,
  useSetUserStatus: () => idle,
  useSetUserVerification: () => setVerification,
  useDeleteUser: () => idle,
}));

const { AdminUserDetailPage } = await import("./user-detail.page");

const openConfirm = async (label: string) => {
  render(<AdminUserDetailPage />);
  await userEvent.click(screen.getByRole("button", { name: label }));
};

describe("توثيق حسابٍ قائم", () => {
  beforeEach(() => {
    setVerification.mutate.mockClear();
    current = { ...user, isVerified: false };
  });

  it("زرّ التوثيق يفتح تأكيداً، والتأكيد يرفع التوثيق", async () => {
    await openConfirm("admin.verifyAccount");

    // لا نداء قبل التأكيد: الزرّ يسأل، لا يفعل.
    expect(setVerification.mutate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "admin.verify" }));

    expect(setVerification.mutate).toHaveBeenCalledTimes(1);
    expect(setVerification.mutate.mock.calls[0]![0]).toEqual({
      id: "u-1",
      isVerified: true,
    });
  });

  /**
   * والسحب هو الاتجاه الآخر لا زرٌّ آخر: لو أرسل `true` دائماً لبدا يعمل
   * على كل حسابٍ غير موثّق، وسكت عن الموثّق سكوتاً لا يُفسَّر.
   */
  it("وحسابٌ موثّقٌ يعرض السحب، والتأكيد يرسل false", async () => {
    current = { ...user, isVerified: true };

    await openConfirm("admin.unverifyAccount");
    await userEvent.click(
      screen.getByRole("button", { name: "admin.unverify" }),
    );

    expect(setVerification.mutate.mock.calls[0]![0]).toEqual({
      id: "u-1",
      isVerified: false,
    });
  });
});
