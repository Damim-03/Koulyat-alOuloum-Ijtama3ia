/**
 * إنشاء أستاذ — ما لا تصنعه قاعدةٌ حقيقية.
 *
 * منصّةٌ لم يُسجَّل فيها نطاقٌ جامعيّ بعد: يُقال ذلك، لا «النطاقات المقبولة:»
 * بقائمةٍ فارغة. وعشر محاولاتٍ لرقمٍ وظيفيّ كلّها مأخوذة: يُردّ بسببٍ مفهوم،
 * بدل أن يُنشأ أستاذٌ برقمٍ يصطدم بغيره. (وسائر الخدمة في اختبار التكامل.)
 */
jest.mock("../../core/prisma/client", () => ({
  prisma: {
    universityDomain: { findUnique: jest.fn(), findMany: jest.fn() },
    professor: { findUnique: jest.fn(), findFirst: jest.fn() },
    // يُقرأ لحظة التحميل (core/topic/topic-status).
    graduationTopic: { fields: { maxRequests: "maxRequests" } },
  },
}));

import { prisma } from "../../core/prisma/client";
import { tr } from "../../core/i18n";
import { createProfessorService } from "./admin.service";

const db = prisma as unknown as {
  universityDomain: { findUnique: jest.Mock; findMany: jest.Mock };
  professor: { findUnique: jest.Mock; findFirst: jest.Mock };
};
const professor = {
  firstNameLatin: "Nadia",
  lastNameLatin: "SAIDI",
  password: "A-strong-Passw0rd!",
  universityEmail: "nadia@univ.dz",
  departmentId: "dep-1",
} as Parameters<typeof createProfessorService>[0];

describe("createProfessorService", () => {
  beforeEach(() => jest.resetAllMocks());

  it("لا نطاق جامعيّ في المنصّة ⇒ يُقال ذلك", async () => {
    db.universityDomain.findUnique.mockResolvedValue(null);
    db.universityDomain.findMany.mockResolvedValue([]);
    await expect(createProfessorService(professor)).rejects.toMatchObject({ statusCode: 400, message: tr("emailDomain.none") });
  });

  it("وعشر محاولاتٍ لرقمٍ وظيفيّ كلّها مأخوذة ⇒ يُردّ، ولا يُنشأ شيء", async () => {
    db.universityDomain.findUnique.mockResolvedValue({ domain: "univ.dz" });
    db.professor.findUnique.mockResolvedValue({ id: "taken" });
    await expect(createProfessorService(professor)).rejects.toMatchObject({ message: tr("professor.employeeNumberFailed") });
    expect(db.professor.findUnique).toHaveBeenCalledTimes(10);
    expect(db.professor.findFirst).not.toHaveBeenCalled();
  });
});
