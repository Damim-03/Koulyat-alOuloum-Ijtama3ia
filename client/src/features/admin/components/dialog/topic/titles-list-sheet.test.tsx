/**
 * قائمةُ عناوين المذكرات.
 *
 * ما يستحقّ حارساً: أنّ كلّ وضعٍ يكتب عنوانه وأعمدته — بعد الإسناد الطلبةُ
 * مجموعين بفاصلة وقائدُهم أوّلاً، وقبله عددُ الطلبة — وأنّ «د.» لا تسبق إلّا
 * من رتبتُه رتبةُ دكتور، وأنّ الترويسة لا تكرّر «قسم» ولا «شعبة» على اسمٍ
 * يحملهما، وأنّ السنة تُكتب كما هي لا مقلوبةً في سطرٍ عربيّ.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TitlesListSheet } from "./titles-list-sheet";
import { supervisorName } from "./titles-list-utils";
import type { TitlesListRow, TopicTitlesList } from "../../../../../types/admin";

const person = (firstName: string, lastName: string) => ({ firstName, lastName, firstNameLatin: null, lastNameLatin: null });

const row = (over: Partial<TitlesListRow> = {}): TitlesListRow => ({
  id: "t-1",
  title: "أثر خاصية الريلز في المنصات الرقمية على التحصيل الدراسي",
  status: "full",
  maxStudents: 3,
  supervisor: { id: "p-1", grade: ["أستاذ محاضر أ"], email: "h.gueda@univ-eloued.dz", ...person("حمزة", "قدة") },
  students: [
    { registrationNumber: "1", isLeader: true, ...person("فريال", "أبيش") },
    { registrationNumber: "2", isLeader: false, ...person("سعيدة", "قسوم") },
  ],
  ...over,
});

const data = (mode: "before" | "after", rows = [row()]): TopicTitlesList => ({
  mode,
  year: { id: "y", title: "2025/2026" },
  groups: [
    {
      specialization: { id: "s", name: "السمعي البصري", level: "master" },
      filiere: { id: "f", name: "علوم الإعلام والاتصال" },
      department: { id: "d", name: "قسم الإعلام والاتصال" },
      faculty: { id: "c", name: "كلية العلوم الاجتماعية والإنسانية" },
      rows,
    },
  ],
});

describe("قائمة عناوين المذكرات", () => {
  it("بعد الإسناد: العنوان والسنة، والطلبة بينهم «/»، والمشرف بلقبه وبريده الجامعي، وعدد من في المجموعة", () => {
    render(<TitlesListSheet data={data("after")} orientation="portrait" />);
    const sheet = screen.getByTestId("titles-sheet");

    expect(within(sheet).getByRole("heading").textContent).toBe("قائمة عناوين مذكرات الماستر للسنة الجامعية 2025/2026");
    expect(within(sheet).getByText("فريال أبيش / سعيدة قسوم")).toBeTruthy();
    expect(within(sheet).getByText("د. حمزة قدة")).toBeTruthy();
    expect(within(sheet).getByRole("columnheader", { name: "الطالب" })).toBeTruthy();
    expect(within(sheet).getByRole("columnheader", { name: "البريد الجامعي للأستاذ المشرف" })).toBeTruthy();
    expect(within(sheet).getAllByRole("cell").some((td) => td.textContent === "h.gueda@univ-eloued.dz")).toBe(true);
    // the group as it is — two students — not the topic's capacity (three)
    expect(within(sheet).getByRole("columnheader", { name: "عدد الطلبة في المجموعة" })).toBeTruthy();
    expect(within(sheet).getAllByRole("cell").at(-1)?.textContent).toBe("2");
  });

  it("قبل الإسناد: المواضيع المقترحة، وبريد المشرف، وعدد الطلبة لا أسماؤهم", () => {
    render(<TitlesListSheet data={data("before", [row({ students: [] })])} orientation="landscape" />);
    const sheet = screen.getByTestId("titles-sheet");

    expect(within(sheet).getByRole("heading").textContent).toContain("قائمة المواضيع المقترحة لمذكرات الماستر");
    expect(within(sheet).getByRole("columnheader", { name: "عدد الطلبة في المجموعة" })).toBeTruthy();
    expect(within(sheet).getByRole("columnheader", { name: "البريد الجامعي للأستاذ المشرف" })).toBeTruthy();
    // The address is drawn in two pieces (it breaks before its «@»), and reads whole.
    expect(within(sheet).getAllByRole("cell").some((td) => td.textContent === "h.gueda@univ-eloued.dz")).toBe(true);
    expect(within(sheet).queryByRole("columnheader", { name: "الطالب" })).toBeNull();
    expect(within(sheet).getByRole("cell", { name: "3" })).toBeTruthy();
  });

  it("والترويسة لا تكرّر «قسم» على اسمٍ يحمله، وتضيف «شعبة» حيث تنقص", () => {
    render(<TitlesListSheet data={data("after")} orientation="portrait" />);
    expect(screen.getByText("قسم الإعلام والاتصال")).toBeTruthy();
    expect(screen.queryByText(/قسم قسم/)).toBeNull();
    expect(screen.getByText("شعبة علوم الإعلام والاتصال")).toBeTruthy();
    expect(screen.getByText("تخصص: السمعي البصري")).toBeTruthy();
  });
});

describe("لقب المشرف", () => {
  it("«د.» لمن رتبتُه رتبةُ دكتور وحده", () => {
    const sup = (grade: unknown) => supervisorName({ id: "p", grade, email: null, ...person("زياد", "اسماعيل") });
    expect(sup(["أستاذ محاضر ب"])).toBe("د. زياد اسماعيل");
    expect(sup(["أستاذ التعليم العالي"])).toBe("د. زياد اسماعيل");
    expect(sup(["أستاذ مساعد أ"])).toBe("زياد اسماعيل");
    expect(sup(null)).toBe("زياد اسماعيل");
  });
});
