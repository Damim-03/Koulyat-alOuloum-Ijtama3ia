/**
 * قائمةُ المواضيع على صورة قائمة القسم الرسمية.
 *
 * يُحرس: الترويسة باللغتين (سطور الدولة والوزارة والجامعة، والكلّية والقسم
 * باللاتينية والعربية) أيّاً كانت لغة الورقة؛ والعنوان بالسنة «2026–2027»؛
 * وأنّ أوّل عمود رمزُ النوع (AI01، AI02، IoT01) بلونٍ من لون النوع، أو رقمُ
 * الموضوع إن لم يكن له نوع؛ وأنّ اسم المشرف يُكتب مرّةً بجانب مواضيعه
 * المتتالية؛ وأنّ المشرف المساعد «—» حين لا يكون؛ وأنّ الوصف القصير ثمّ
 * بداية الكامل؛ وأنّ خانة النوع بلونه؛ وأنّ الأعمدة تتبع ما اختير؛ وأنّ
 * «د.» للدكتور في العربية وحدها، واللقب بالحروف الكبيرة في اللاتينية.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TitlesListSheet } from "./titles-list-sheet";
import { columnsWithData, inkOf, latinGaps, sheetHeading, supervisorName, supervisorSpans } from "./titles-list-utils";
import { typeCodes } from "../../../../../lib/topic-extras";
import type { TitlesListRow, TopicTitlesList } from "../../../../../types/admin";

const person = (firstName: string, lastName: string, latin: [string, string] | null = null) => ({
  firstName,
  lastName,
  firstNameLatin: latin?.[0] ?? null,
  lastNameLatin: latin?.[1] ?? null,
});
const AI = { id: "tt1", name: "الذكاء الاصطناعي", code: "AI", color: "#dbeafe", sortOrder: 0 };
const IOT = { id: "tt2", name: "إنترنت الأشياء", code: "IoT", color: "#dcfce7", sortOrder: 1 };
const supA = { id: "p-a", grade: ["أستاذ محاضر أ"], email: "a.laouid@univ-eloued.dz", ...person("عبد القادر", "لعويد", ["Abdelkader", "Laouid"]) };
const supB = { id: "p-b", grade: ["أستاذ مساعد أ"], email: "k.belila@univ-eloued.dz", ...person("خولة", "بليلة", ["Khaoula", "Belila"]) };

const row = (id: string, over: Partial<TitlesListRow> = {}): TitlesListRow => ({
  id,
  title: `موضوع ${id}`,
  status: "approved",
  maxStudents: 2,
  supervisor: supA,
  students: [],
  ...over,
});

const ROWS = [
  row("1", { type: IOT, summary: "وكيلٌ يصدّ الهجمات", coSupervisor: { ...supB } }),
  row("2", { type: IOT, excerpt: "بداية الوصف الكامل…" }),
  row("3", { type: AI }),
  row("4", { supervisor: supB }),
];

const data = (rows = ROWS, mode: "before" | "after" = "before"): TopicTitlesList => ({
  mode,
  year: { id: "y", title: "2026/2027" },
  groups: [
    {
      specialization: { id: "s", name: "الذكاء الاصطناعي", level: "master" },
      filiere: { id: "f", name: "إعلام آلي" },
      department: { id: "d", name: "قسم الإعلام الآلي", nameLatin: "Department of Computer Science" },
      faculty: { id: "c", name: "كلية العلوم الدقيقة", nameLatin: null },
      rows,
    },
  ],
});

describe("الترويسة والعنوان", () => {
  it("سطور الدولة والوزارة والجامعة بالعربية وتحت كلٍّ ترجمتها؛ والكلّية والقسم بالخطّين", () => {
    render(<TitlesListSheet data={data()} />);
    const sheet = screen.getByTestId("titles-sheet");
    for (const line of [
      "الجمهورية الجزائرية الديمقراطية الشعبية",
      "People's Democratic Republic of Algeria",
      "وزارة التعليم العالي والبحث العلمي",
      "Ministry of Higher Education and Scientific Research",
      "جامعة الشهيد حمه لخضر – الوادي",
      "University of Shahid Hama Lakhdar – El Oued",
      "كلية العلوم الدقيقة",
      "قسم الإعلام الآلي",
    ])
      expect(within(sheet).getByText(line)).toBeTruthy();
    // Latin names where the administration gave them; none written in their place.
    expect(within(sheet).getByTestId("titles-places-latin")).toHaveTextContent("Department of Computer Science");
    expect(within(sheet).getByTestId("titles-places-latin")).not.toHaveTextContent("كلية");
    expect(latinGaps(data().groups)).toEqual(["كلية العلوم الدقيقة"]);
  });

  it("العنوان بالسنة كما يكتبها القسم، بكلّ لغة", () => {
    expect(sheetHeading("before", "master", "en", "2026/2027")).toBe("List of Proposed Master's Thesis Topics for the 2026–2027 Academic Year");
    expect(sheetHeading("before", "master", "fr", "2026/2027")).toBe("Liste des sujets de mémoire de Master proposés pour l'année universitaire 2026–2027");
    expect(sheetHeading("before", "master", "ar", "2026/2027")).toBe("قائمة المواضيع المقترحة لمذكرات الماستر للسنة الجامعية 2026–2027");
    expect(sheetHeading("after", "master", "ar", null)).toBe("قائمة عناوين مذكرات الماستر");
    render(<TitlesListSheet data={data()} lang="en" />);
    expect(screen.getByRole("heading").textContent).toBe("List of Proposed Master's Thesis Topics for the 2026–2027 Academic Year");
  });

  it("بالفرنسية: سطور الترويسة اللاتينية بالفرنسية", () => {
    render(<TitlesListSheet data={data()} lang="fr" />);
    const sheet = screen.getByTestId("titles-sheet");
    expect(sheet).toHaveAttribute("dir", "ltr");
    expect(within(sheet).getByText("République Algérienne Démocratique et Populaire")).toBeTruthy();
    expect(within(sheet).getByRole("columnheader", { name: "Encadrant" })).toBeTruthy();
  });
});

describe("الجدول", () => {
  it("أعمدة القسم: # والمشرف والمشرف المساعد والعنوان والوصف المختصر والتخصص (نوع الموضوع)", () => {
    render(<TitlesListSheet data={data()} lang="en" />);
    const heads = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(heads).toEqual(["#", "Supervisor", "Co-supervisor", "Topic title", "Short description", "Specialty"]);
  });

  it("الرمز بلون النوع، أو رقم الموضوع بلا نوع؛ والوصف القصير ثمّ بداية الكامل؛ وخانة النوع بلونه", () => {
    expect(typeCodes(ROWS)).toEqual(["IoT01", "IoT02", "AI01", null]);
    render(<TitlesListSheet data={data()} />);
    const rows = screen.getAllByTestId("titles-row");
    const code = (r: HTMLElement) => r.querySelector("td")!;
    expect(code(rows[0]!).textContent).toBe("IoT01");
    expect(code(rows[1]!).textContent).toBe("IoT02");
    expect(code(rows[2]!).textContent).toBe("AI01");
    expect(code(rows[3]!).textContent).toBe("4");
    expect(code(rows[0]!).style.color).toBeTruthy();
    expect(code(rows[0]!).style.color).not.toBe(code(rows[2]!).style.color);
    expect(rows[0]).toHaveTextContent("وكيلٌ يصدّ الهجمات");
    expect(rows[1]).toHaveTextContent("بداية الوصف الكامل…");
    const type = within(rows[0]!).getByText("إنترنت الأشياء");
    expect(type.style.background).toBeTruthy();
    // No type: a dash, uncoloured.
    expect(within(rows[3]!).getAllByText("—").length).toBe(2);
  });

  it("المشرف مرّةً في خليّةٍ تمتدّ على مواضيعه المتتالية؛ والمساعد باسمه أو «—»", () => {
    expect(supervisorSpans(ROWS)).toEqual([3, 0, 0, 1]);
    render(<TitlesListSheet data={data()} />);
    const named = screen.getAllByText("د. عبد القادر لعويد");
    expect(named).toHaveLength(1);
    expect(named[0]!.closest("td")).toHaveAttribute("rowspan", "3");
    const rows = screen.getAllByTestId("titles-row");
    expect(rows[0]).toHaveTextContent("خولة بليلة");
    expect(within(rows[1]!).getByText("—")).toBeTruthy();
  });

  it("بعد الإسناد: الطلبة بعد العنوان؛ والبريد والعدد يُضافان إن اختيرا", () => {
    const after = data([row("x", { students: [{ registrationNumber: "1", isLeader: true, ...person("فريال", "أبيش") }, { registrationNumber: "2", isLeader: false, ...person("سعيدة", "قسوم") }] })], "after");
    const cols = columnsWithData(after.groups);
    expect([...cols].sort()).toEqual(["coSupervisor", "summary"]);
    cols.add("email");
    cols.add("count");
    render(<TitlesListSheet data={after} columns={cols} />);
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "#",
      "المشرف",
      "المشرف المساعد",
      "عنوان الموضوع",
      "الطلبة",
      "وصف مختصر",
      "البريد الجامعي للمشرف",
      "عدد الطلبة",
    ]);
    expect(screen.getByText("فريال أبيش / سعيدة قسوم")).toBeTruthy();
    expect(screen.getAllByRole("cell").some((td) => td.textContent === supA.email)).toBe(true);
    expect(screen.getAllByRole("cell").at(-1)?.textContent).toBe("2");
  });
});

describe("الأسماء", () => {
  it("«د.» للدكتور في العربية وحدها؛ وفي اللاتينية الاسم ثمّ اللقب بالكبيرة", () => {
    expect(supervisorName(supA)).toBe("د. عبد القادر لعويد");
    expect(supervisorName(supB)).toBe("خولة بليلة");
    expect(supervisorName({ ...supB, grade: null })).toBe("خولة بليلة");
    expect(supervisorName(supA, "en")).toBe("Abdelkader LAOUID");
    // No Latin name: the Arabic one, rather than nothing.
    expect(supervisorName({ ...supA, firstNameLatin: null, lastNameLatin: null }, "fr")).toBe("عبد القادر لعويد");
  });

  it("حبر الرمز من لون النوع: داكنٌ من صبغته", () => {
    const green = inkOf("#dcfce7");
    const blue = inkOf("#dbeafe");
    expect(green).toMatch(/^#[0-9a-f]{6}$/);
    expect(green).not.toBe(blue);
    // Dark enough on white: each channel well below the tint's.
    expect(parseInt(green.slice(1, 3), 16)).toBeLessThan(120);
  });
});
