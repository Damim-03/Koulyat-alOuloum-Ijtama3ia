/**
 * نافذةُ مسح رمز الورقة.
 *
 * القارئُ الشريطيّ لا يضغط زرّاً: يطبع ثلاثة عشر رقماً دفعةً وينتهي. فإن
 * لم يُرسَل الرمز عند اكتماله وقف الموظّف أمام حقلٍ امتلأ ولا شيء يحدث —
 * وهو عطبٌ لا يظهر في قراءة الشيفرة، إنّما أمام القارئ.
 *
 * ويُحرَس معه أنّ رقم التحقّق يُفحص قبل الطلب: رمزٌ اختلّت خانةٌ منه يُردّ
 * في مكانه بقولٍ مفهوم، لا بـ«لا توجد ورقة» يُوهم أنّ الورقة مزوّرة.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SupervisionDocument } from "../api/supervision.api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock("react-router-dom", () => ({
  useParams: () => ({ lang: "ar" }),
  Link: ({
    to,
    children,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

/** ٢٩١٢٣٤٥٦٧٨٩٠ ورقمُ تحقّقها ٦. */
const CODE = "2912345678906";

const document_: SupervisionDocument = {
  id: "doc-1",
  documentNumber: "SUP-2026-000042",
  verificationToken: "tok_abcdefghijklmnopqrstuvwxyz012345",
  barcode: CODE,
  topicId: "topic-7",
  status: "active",
  snapshot: {
    topicTitle: "أثر البرامج التنموية على التماسك الأسري",
    supervisorName: "عبد الرحمن العوامر",
    level: "master",
    academicYear: "2025/2026",
    specialization: "علم الاجتماع",
    students: [
      { fullName: "محمد الأمين بن عمار", registrationNumber: "202039012345" },
    ],
    issuedAt: new Date("2026-09-21").toISOString(),
  },
  createdAt: new Date("2026-09-21").toISOString(),
  revokedAt: null,
};

/** يسجّل ما طُلب من الخادم، فيُقاس ما لم يُطلب كما يُقاس ما طُلب. */
const asked: (string | null)[] = [];
let known = true;

vi.mock("../hooks/supervision-hook", () => ({
  useSupervisionByCode: (code: string | null) => {
    asked.push(code);
    return {
      data: code && known ? document_ : null,
      isFetching: false,
    };
  },
}));

const { ScanDialog } = await import("./scan-dialog");

const requested = () => asked.filter((c): c is string => !!c);

beforeEach(() => {
  asked.length = 0;
  known = true;
});

describe("نافذة مسح الرمز", () => {
  it("الرمزُ المكتمل يُرسَل من تلقائه بلا ضغط زرّ", async () => {
    render(<ScanDialog onClose={() => {}} />);

    await userEvent.type(screen.getByRole("textbox"), CODE);

    expect(requested()).toContain(CODE);
    expect(screen.getByText(document_.documentNumber)).toBeTruthy();
    expect(
      screen.getByText(document_.snapshot.topicTitle),
    ).toBeTruthy();
  });

  /** خانةٌ مختلّة تُردّ هنا، ولا تُرسَل إلى الخادم لتعود «لا توجد ورقة». */
  it("ورمزٌ اختلّ رقمُ تحقّقه يُردّ قبل أن يُطلب", async () => {
    render(<ScanDialog onClose={() => {}} />);

    await userEvent.type(screen.getByRole("textbox"), "2912345678904");

    expect(requested()).toHaveLength(0);
    expect(screen.getByText("verify.badCode")).toBeTruthy();
  });

  it("والحروفُ لا تدخل الحقل — القارئ يرسل أرقاماً وحدها", async () => {
    render(<ScanDialog onClose={() => {}} />);

    const field = screen.getByRole("textbox") as HTMLInputElement;
    await userEvent.type(field, "29a12b345678x906");

    expect(field.value).toBe(CODE);
  });

  it("ورمزٌ لا ورقةَ له يقول ذلك", async () => {
    known = false;
    render(<ScanDialog onClose={() => {}} />);

    await userEvent.type(screen.getByRole("textbox"), CODE);

    expect(screen.getByText("supervision.scanNotFound")).toBeTruthy();
  });

  /** من الورقة إلى مشروعها: الوِجهة معرّفُ الموضوع لا معرّف الوثيقة. */
  it("ويفتح الموضوع الذي تخصّه الورقة", async () => {
    render(<ScanDialog onClose={() => {}} />);

    await userEvent.type(screen.getByRole("textbox"), CODE);

    const link = screen.getByText("supervision.openTopic").closest("a");
    expect(link?.getAttribute("href")).toBe("/ar/admin/topics/topic-7");
  });
});
