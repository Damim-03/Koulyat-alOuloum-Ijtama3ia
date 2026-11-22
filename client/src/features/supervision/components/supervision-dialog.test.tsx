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
import { act, render, screen, waitFor } from "@testing-library/react";
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
  printedAt: null,
  printedByRole: null,
  printedByName: null,
  printCount: 0,
  lastPrintedAt: null,
  version: "v1",
};

let preview: {
  data?: { snapshot: SupervisionSnapshot; active: SupervisionDocument | null };
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: ReturnType<typeof vi.fn>;
};
const issue = { mutate: vi.fn(), isPending: false };
const print = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
const toast = vi.hoisted(() => ({ warning: vi.fn(), error: vi.fn() }));

vi.mock("../hooks/supervision-hook", () => ({
  useSupervisionPreview: () => preview,
  useIssueSupervisionDocument: () => issue,
  usePrintSupervisionDocument: () => print,
}));
vi.mock("sonner", () => ({ toast }));

/** What the server answers a first print with: who, and when. */
const printedDocument = (over: Partial<SupervisionDocument> = {}): SupervisionDocument => ({
  ...activeDocument,
  printedAt: new Date("2026-11-17T10:30:00Z").toISOString(),
  printedByRole: "professor",
  printedByName: "عبد الرحمن العوامر",
  printCount: 1,
  lastPrintedAt: new Date("2026-11-17T10:30:00Z").toISOString(),
  ...over,
});

/** An answer of the server refused with its status, as axios rejects it. */
const refused = (status: number) => Object.assign(new Error("refused"), { isAxiosError: true, response: { status, data: { message: `server ${status}` } } });

const { SupervisionDialog } = await import("./supervision-dialog");

function setPreview(active: SupervisionDocument | null) {
  preview = {
    data: { snapshot, active },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
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

  it("تُعرض الطباعة للوثيقة الصالحة: تُسجَّل بنسختها أوّلاً، ثمّ تُفتح طابعة المتصفّح", async () => {
    setPreview(activeDocument);
    print.mutateAsync.mockResolvedValue(printedDocument());
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);

    expect(screen.queryByText("supervision.issue")).toBeNull();
    await userEvent.click(screen.getByText("supervision.print"));
    expect(print.mutateAsync).toHaveBeenCalledWith({ id: activeDocument.id, version: activeDocument.version });
    expect(window.print).toHaveBeenCalledTimes(1);
    // Now printed: and said so.
    expect(await screen.findByTestId("printed-badge")).toBeTruthy();
    expect(screen.getByTestId("print-status").dataset.printed).toBe("true");
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

describe("الطباعة: قبلها تتبع الورقة موضوعها، وأوّلها يثبّتها", () => {
  it("لم تُطبع بعد ⇒ يُقال إنّها تتبع موضوعها ونصّها حتى أوّل طباعة", () => {
    setPreview(activeDocument);
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);
    const status = screen.getByTestId("print-status");
    expect(status.dataset.printed).toBe("false");
    expect(status.textContent).toContain("supervision.notPrintedHint");
    expect(screen.queryByTestId("printed-badge")).toBeNull();
  });

  it("طُبعت ⇒ من طبعها أوّل مرّة ومتى، وكم مرّة، وأنّها مثبّتة", () => {
    setPreview(printedDocument({ printCount: 3 }));
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);
    const status = screen.getByTestId("print-status");
    expect(status.textContent).toContain("supervision.printedFirst");
    expect(status.textContent).toContain("supervision.printedByRole.professor — عبد الرحمن العوامر");
    expect(status.textContent).toContain('"n":3');
    expect(status.textContent).toContain("supervision.printedLocked");
  });

  it("وإن طبعها موظّفٌ والقارئ ليس الإدارة ⇒ «الإدارة» بلا اسم", () => {
    setPreview(printedDocument({ printedByRole: "admin", printedByName: null }));
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);
    expect(screen.getByTestId("print-status").textContent).toContain('"who":"supervision.printedByRole.admin"');
  });

  it("وصادرةٌ قبل تسجيل الطباعة ⇒ تُعامَل كمطبوعة، بلا اسم", () => {
    setPreview(printedDocument({ printedByRole: null, printedByName: null }));
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);
    expect(screen.getByTestId("print-status").textContent).toContain("supervision.printedBefore");
  });

  it("تغيّرت منذ عُرضت (٤٠٩) ⇒ لا طباعة، وتُجلب كما صارت ويُقال ذلك", async () => {
    setPreview(activeDocument);
    print.mutateAsync.mockRejectedValue(refused(409));
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);
    await userEvent.click(screen.getByText("supervision.print"));
    await waitFor(() => expect(preview.refetch).toHaveBeenCalled());
    expect(window.print).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith("server 409");
  });

  it("وتعذّر تسجيلها ⇒ لا طباعة أيضاً: ورقةٌ قد تكون على الورق ورقةٌ مثبّتة", async () => {
    setPreview(activeDocument);
    print.mutateAsync.mockRejectedValue(refused(500));
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);
    await userEvent.click(screen.getByText("supervision.print"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("server 500"));
    expect(window.print).not.toHaveBeenCalled();
  });

  it("Ctrl+P وهي معروضة يُسجَّل طباعةً؛ وطباعة الزرّ لا تُسجَّل مرّتين", async () => {
    setPreview(activeDocument);
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);
    act(() => void window.dispatchEvent(new Event("beforeprint")));
    expect(print.mutate).toHaveBeenCalledWith({ id: activeDocument.id, version: activeDocument.version }, expect.anything());

    print.mutate.mockClear();
    print.mutateAsync.mockResolvedValue(printedDocument());
    (window.print as ReturnType<typeof vi.fn>).mockImplementation(() => window.dispatchEvent(new Event("beforeprint")));
    await userEvent.click(screen.getByText("supervision.print"));
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(print.mutate).not.toHaveBeenCalled();
  });

  it("والملغاة لا تُسجَّل طباعتها بـCtrl+P", () => {
    setPreview({ ...activeDocument, status: "revoked", revokedAt: new Date().toISOString() });
    render(<SupervisionDialog topicId="t-1" onClose={() => {}} />);
    act(() => void window.dispatchEvent(new Event("beforeprint")));
    expect(print.mutate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("print-status")).toBeNull();
  });
});
