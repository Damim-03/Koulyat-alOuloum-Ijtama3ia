/**
 * توثيق حساب الطالب من صفحته.
 *
 * وسؤالٌ واحدٌ يستحقّ اختباراً هنا: **أيّ معرّفٍ يُرسَل؟** فالمسار على
 * `/users/:id`، والصفحة بين يديها معرّفان متشابهان — `student.id` و
 * `student.userId`. وإرسال الأوّل لا يفشل فشلاً صريحاً دائماً: قد يصادف
 * حساباً آخر فيوثّقه، وهو أسوأ من ٤٠٤.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("../../../../i18n/i18n", () => ({
  default: { language: "ar", t: (key: string) => key },
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "s-1", lang: "ar" }),
}));
vi.mock("../../components/dialog/student/student-edit-dialog.form", () => ({
  StudentEditDialog: () => null,
}));

const student = {
  id: "s-1",
  userId: "u-9",
  registrationNumber: "202039435870",
  user: {
    id: "u-9",
    firstName: "سارة",
    lastName: "بن علي",
    email: null,
    username: null,
    phone: null,
    role: "student",
    status: "active",
    isVerified: false,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
  },
  specialization: null,
  academicYear: null,
  ledGroupRequests: [],
  groupRequestMembers: [],
  projectMembers: [],
};

const setVerification = { mutate: vi.fn(), isPending: false };
let current = student;

vi.mock("../../hooks/admin-hook", () => ({
  useStudent: () => ({ data: current, isLoading: false, refetch: vi.fn() }),
  useDeleteStudent: () => ({ mutate: vi.fn(), isPending: false }),
  useSetUserVerification: () => setVerification,
}));

const { AdminStudentDetailPage } = await import("./student-detail.page");

describe("توثيق الطالب من صفحته", () => {
  beforeEach(() => {
    setVerification.mutate.mockClear();
    current = { ...student, user: { ...student.user, isVerified: false } };
  });

  it("يرسل معرّف الحساب لا معرّف الطالب", async () => {
    render(<AdminStudentDetailPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "admin.verifyAccount" }),
    );
    expect(setVerification.mutate).not.toHaveBeenCalled(); // التأكيد أوّلاً

    await userEvent.click(screen.getByRole("button", { name: "admin.verify" }));

    expect(setVerification.mutate.mock.calls[0]![0]).toEqual({
      id: "u-9",
      isVerified: true,
    });
  });

  it("وحسابٌ موثّقٌ يعرض السحب", async () => {
    current = { ...student, user: { ...student.user, isVerified: true } };
    render(<AdminStudentDetailPage />);

    await userEvent.click(
      screen.getByRole("button", { name: "admin.unverifyAccount" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "admin.unverify" }),
    );

    expect(setVerification.mutate.mock.calls[0]![0]).toEqual({
      id: "u-9",
      isVerified: false,
    });
  });
});
