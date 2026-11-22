/**
 * الورقة تُطبع من قالبها: النصّ الذي حُفظ يوم صدرت — أو الأصليّ لوثيقةٍ
 * أقدم من القالب، وهو ما صدرت به.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { SupervisionSnapshot } from "../api/supervision.api";
import { DEFAULT_SUPERVISION_TEMPLATE as D } from "../lib/sheet-template";
import { SupervisionSheet } from "./supervision-sheet";

vi.mock("../../../assets/university-logo.png", () => ({ default: "logo.png" }));
vi.mock("../../../assets/Faculty.png", () => ({ default: "faculty.png" }));

const base: SupervisionSnapshot = {
  topicTitle: "أثر البرامج التنموية على التماسك الأسري",
  supervisorName: "عبد الرحمن العوامر",
  level: "doctorate",
  academicYear: "2025/2026",
  specialization: "علم الاجتماع",
  students: [{ fullName: "سارة بوقرة", registrationNumber: "202039012346" }],
  issuedAt: new Date("2026-09-21").toISOString(),
};

const sheet = (snapshot: SupervisionSnapshot) => {
  render(<SupervisionSheet snapshot={snapshot} documentNumber="SUP-2026-000042" barcode={null} />);
  return screen.getByTestId("supervision-sheet");
};

describe("نصّ الورقة", () => {
  it("وثيقةٌ بلا قالب ⇒ النصّ الأصليّ وشعارا المنصّة", () => {
    const el = sheet(base);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(D.title);
    for (const line of D.header) expect(screen.getByTestId("sup-header")).toHaveTextContent(line);
    expect(screen.getByTestId("sup-header")).toHaveTextContent("قسم علم الاجتماع");
    expect(el).toHaveTextContent(D.signLabel);
    // Two degrees, as always: the doctorate has no box in the original.
    expect([...el.querySelectorAll("[data-degree]")].map((x) => x.getAttribute("data-degree"))).toEqual(["licence", "master"]);
    expect([...el.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual(["logo.png", "faculty.png"]);
  });

  it("وثيقةٌ بقالبها ⇒ عباراته وترويسته وشهاداته وشعاراه", () => {
    const el = sheet({
      ...base,
      template: {
        ...D,
        header: ["سطرٌ أوّل", "سطرٌ ثانٍ"],
        department: { show: false, prefix: "قسم" },
        title: "عنوانٌ آخر",
        studentLabel: "الطالب:",
        yearLabel: "الموسم:",
        signLabel: "توقيع المشرف:",
        degrees: { licence: "", master: "الماستر", doctorate: "الدكتوراه" },
        universityLogo: "/uploads/cards/u.png",
        facultyLogo: null,
      },
    });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("عنوانٌ آخر");
    const header = screen.getByTestId("sup-header");
    expect(header).toHaveTextContent("سطرٌ أوّل");
    expect(header).not.toHaveTextContent(D.header[0]!);
    // No department line.
    expect(header).not.toHaveTextContent("علم الاجتماع");
    expect(el).toHaveTextContent("1) الطالب: سارة بوقرة");
    expect(el).toHaveTextContent("الموسم: 2025/2026");
    expect(el).toHaveTextContent("توقيع المشرف:");
    expect(el).not.toHaveTextContent(D.signLabel);
    // The licence has no name: no box; the topic's level is ticked.
    expect([...el.querySelectorAll("[data-degree]")].map((x) => x.getAttribute("data-degree"))).toEqual(["master", "doctorate"]);
    expect(el.querySelector("[data-degree='doctorate']")).toHaveTextContent("✕");
    const [university, faculty] = [...el.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(university).toMatch(/\/uploads\/cards\/u\.png$/);
    expect(faculty).toBe("faculty.png");
  });

  it("عباراتٌ فارغة ⇒ لا تُطبع، وتبقى البيانات التي تليها", () => {
    const el = sheet({
      ...base,
      template: { ...D, header: ["سطر", " "], title: "", supervisorLead: "", topicLead: "", studentLabel: "", yearLabel: "", signLabel: "" },
    });
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByTestId("sup-header").querySelectorAll("p")).toHaveLength(2); // the line, and the department
    expect(el.querySelectorAll(".sup-lead")).toHaveLength(2); // the degree's and the students'
    expect(el).toHaveTextContent(base.supervisorName);
    expect(el).toHaveTextContent(base.topicTitle);
    expect(el).toHaveTextContent("1) سارة بوقرة");
    expect(el.querySelector(".sup-year")).toHaveTextContent(/^2025\/2026$/);
    expect(el.querySelector(".sup-sign p")).toBeNull();
  });

  it("بادئةٌ فارغة ⇒ اسم التخصّص وحده", () => {
    sheet({ ...base, template: { ...D, department: { show: true, prefix: "" } } });
    const last = [...screen.getByTestId("sup-header").querySelectorAll("p")].at(-1)!;
    expect(last.textContent).toBe("علم الاجتماع");
  });
});

describe("سطر التخصّص تحت خانات الشهادة", () => {
  it("بالقالب الجاري ⇒ تحت الخانات: العبارة ثمّ تخصّص الموضوع", () => {
    const el = sheet({ ...base, template: D });
    const line = screen.getByTestId("sup-specialization");
    expect(line).toHaveTextContent("التخصّص: علم الاجتماع");
    // In the degree block, after the boxes.
    const block = line.closest("section")!;
    expect(block.querySelector(".sup-degrees")!.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(el.querySelectorAll("[data-degree]")).toHaveLength(2);
  });

  it("عبارةٌ فارغة ⇒ الاسم وحده؛ ومُطفأ ⇒ لا سطر", () => {
    const { unmount } = render(
      <SupervisionSheet snapshot={{ ...base, template: { ...D, specialization: { show: true, label: "" } } }} documentNumber="SUP-1" barcode={null} />,
    );
    expect(screen.getByTestId("sup-specialization").textContent).toBe("علم الاجتماع");
    unmount();
    sheet({ ...base, template: { ...D, specialization: { show: false, label: "التخصّص:" } } });
    expect(screen.queryByTestId("sup-specialization")).toBeNull();
  });

  it("وثيقةٌ طُبعت قبله — بقالبٍ لا سطر فيه، أو بلا قالب — تبقى كما طُبعت", () => {
    const printedBefore = { ...D };
    delete printedBefore.specialization;
    const { unmount } = render(<SupervisionSheet snapshot={{ ...base, template: printedBefore }} documentNumber="SUP-2" barcode={null} />);
    expect(screen.queryByTestId("sup-specialization")).toBeNull();
    unmount();
    sheet(base);
    expect(screen.queryByTestId("sup-specialization")).toBeNull();
  });

  it("وكلّ الشهادات بلا اسم ⇒ يبقى السطر وحده، بلا عبارة «لنيل شهادة»", () => {
    const el = sheet({ ...base, template: { ...D, degrees: { licence: "", master: "", doctorate: "" } } });
    expect(el.querySelectorAll("[data-degree]")).toHaveLength(0);
    expect(el).not.toHaveTextContent(D.degreeLead);
    expect(screen.getByTestId("sup-specialization")).toHaveTextContent("علم الاجتماع");
  });
});
