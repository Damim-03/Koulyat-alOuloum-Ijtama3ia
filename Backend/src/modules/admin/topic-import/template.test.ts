import ExcelJS from "exceljs";

import { TOPIC_SPEC } from "./columns";
import { buildTopicImportTemplate, type TopicTemplateInput } from "./template";

/**
 * تلميح «السنة الجامعية» في نموذج المواضيع: الخانة الفارغة تأخذ السنة الجارية
 * — فيسمّيها التلميح إن كانت، ويطلب الاختيار من القائمة إن لم تكن.
 */

const spec = {
  id: "spec-psy",
  name: "علم النفس العيادي",
  level: "master",
  filiere: { name: "شعبة علم النفس", department: { name: "قسم العلوم الاجتماعية", faculty: { name: "كلية العلوم الاجتماعية" } } },
};
const professor = {
  id: "p1",
  universityEmail: "p1@univ.dz",
  user: { firstName: null, lastName: null, firstNameLatin: "Youcef", lastNameLatin: "HAMADI" },
};

async function yearPrompt(years: TopicTemplateInput["years"]): Promise<string | undefined> {
  const wb = new ExcelJS.Workbook();
  const buffer = await buildTopicImportTemplate({ specs: [spec], years, professors: [professor] });
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(TOPIC_SPEC.sheetName)!;
  const rules = Object.values((ws as unknown as { dataValidations: { model: Record<string, ExcelJS.DataValidation> } }).dataValidations.model);
  return rules.find((v) => v.promptTitle === "السنة الجامعية")?.prompt;
}

describe("buildTopicImportTemplate — تلميح السنة الجامعية", () => {
  it("بسنةٍ جارية ⇒ اختيارية، والفارغة هي تلك السنة باسمها", async () => {
    const prompt = await yearPrompt([
      { title: "2025/2026", isActive: false },
      { title: "2026/2027", isActive: true },
    ]);
    expect(prompt).toBe("اختيارية. الفارغة هي السنة الجارية (2026/2027).");
  });

  it("وبلا سنةٍ جارية ⇒ تُختار من القائمة", async () => {
    expect(await yearPrompt([{ title: "2025/2026", isActive: false }])).toBe("اختر السنة من القائمة.");
  });
});
