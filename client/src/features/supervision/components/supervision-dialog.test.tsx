/**
 * نافذةُ ورقة الإشراف — ما الذي يُعرض، ومتى يُسمح بالطباعة.
 *
 * الورقة تُطبع وتُمضى وتُودَع، فالخطأ فيها لا يُصحَّح بإعادة تحميل الصفحة.
 * والانقلابُ الصامت الذي يستحقّ حارساً هنا واحد: أن يُفتح زرُّ الطباعة على
 * ورقةٍ ليست صالحة — مسوّدةً لم تُصدَر بعد فرمزُها لا يُحيل إلى شيء، أو
 * وثيقةً ألغيت فالماسحُ يقول «ملغاة» والورقةُ في اليد تبدو سليمة. وفي
 * الحالتين يخرج من الطابعة ورقٌ يبدو رسميّاً ولا يُثبت شيئاً.
 *
 * ويُحرَس معه أنّ رقم التسجيل المعروض هو المسجَّل في القاعدة لا معرّفٌ
 * داخليّ: هو الحقل الوحيد الذي يُميّز الطالب في وثيقةٍ ورقية.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type {
  SupervisionDocument,
  SupervisionSnapshot,
} from "../api/supervision.api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("../../../assets/university-logo.png", () => ({ default: "logo.png" }));
vi.mock("../../../assets/Faculty.png", () => ({ default: "faculty.png" }));

const snapshot: SupervisionSnapshot = {
  topicTitle: "أثر البرامج التنموية على التماسك الأسري",
  supervisorName: "عبد الرحمن العوامر",
  level: "master",
  academicYear: "2025/2026",
  specialization: "علم الاجتماع",
  students: [
    { fullName: "محمد الأمين بن عمار", registrationNumber: "202039012345" },
    { fullName: "سارة بوقرة", registrationNumber: "202039012346" },
  ],
  issuedAt: new Date("2026-09-21").toISOString(),
};

const activeDocument: SupervisionDocument = {
  id: "doc-1",
  documentNumber: "SUP-2026-000042",
  verificationToken: "tok_abcdefghijklmnopqrstuvwxyz012345",
  barcode: "2912345678906",
  topicId: "t-1",
  status: "active",
  snapshot,
  createdAt: new Date("2026-09-21").toISOString(),
  revokedAt: null,
};

let preview: {
  data?: { snapshot: SupervisionSnapshot; active: SupervisionDocument | null };
  isLoading: boolean;
  isError: boolean;
  error: unknown;
};
const issue = { mutate: vi.fn(), isPending: false };

vi.mock("../hooks/supervision-hook", () => ({
  useSupervisionPreview: () => preview,
  useIssueSupervisionDocument: () => issue,
}));

const { SupervisionDialog } = await import("./supervision-dialog");

function setPreview(active: SupervisionDocument | null) {
  preview = {
    data: { snapshot, active },
    isLoading: false,
    isError: false,
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setPreview(null);
  window.print = vi.fn();
});

describe("نافذة ورقة الموافقة على الإشراف", () => {
  it("لا تُعرض الطباعة قبل الإصدار، بل الإصدار", async () => {
    setPreview(null);
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);

    expect(screen.queryByText("supervision.print")).toBeNull();
    await userEvent.click(screen.getByText("supervision.issue"));
    expect(issue.mutate).toHaveBeenCalledWith("t-1", expect.anything());
  });

  it("تُعرض الطباعة للوثيقة الصالحة، وتستدعي طابعة المتصفّح", async () => {
    setPreview(activeDocument);
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);

    expect(screen.queryByText("supervision.issue")).toBeNull();
    await userEvent.click(screen.getByText("supervision.print"));
    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it("لا تُطبع الملغاة — يُعرض بدلها إصدار وثيقةٍ خلفاً لها", () => {
    setPreview({
      ...activeDocument,
      status: "revoked",
      revokedAt: new Date("2026-09-21").toISOString(),
    });
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);

    expect(screen.queryByText("supervision.print")).toBeNull();
    expect(screen.getByText("supervision.issue")).toBeTruthy();
    expect(screen.getByText("supervision.revokedNotice")).toBeTruthy();
  });

  it("تحمل الورقة أرقام التسجيل كما في اللقطة لا معرّفاً داخليّاً", () => {
    setPreview(activeDocument);
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);

    const sheet = screen.getByTestId("supervision-sheet");
    for (const s of snapshot.students) {
      expect(sheet.textContent).toContain(s.registrationNumber);
      expect(sheet.textContent).toContain(s.fullName);
    }
    expect(sheet.textContent).not.toContain(activeDocument.id);
    expect(sheet.textContent).toContain(activeDocument.documentNumber);
  });

  /**
   * الرمزُ الشريطيّ هو ما يُمسح ويُكتب باليد. والرمزُ الطويل لا يُطبع:
   * ورقةٌ تحمله تُعطي لكلّ من رآها مفتاحَ التحقّق الدائم.
   */
  it("تطبع الرمز الشريطيّ مجمَّعاً، ولا تطبع الرمز الطويل", () => {
    setPreview(activeDocument);
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);

    const sheet = screen.getByTestId("supervision-sheet");
    expect(sheet.textContent).toContain("2 912345 678906");
    expect(sheet.textContent).not.toContain(activeDocument.verificationToken);
    expect(sheet.querySelector("svg[role='img']")?.getAttribute("aria-label")).toBe(
      "2912345678906",
    );
  });

  it("والمسوّدة قبل الإصدار بلا رمزٍ شريطيّ — لا رمزَ كاذب", () => {
    setPreview(null);
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);

    const sheet = screen.getByTestId("supervision-sheet");
    expect(sheet.querySelector("svg[role='img']")).toBeNull();
  });
});
