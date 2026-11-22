/**
 * ما لا تبلغه القاعدة الحقيقية من «طلب الموافقة على الإشراف».
 *
 * اختبارات الواجهة (tests/api/supervision.api.test.ts) تمرّ بالمسارات
 * كلّها على قاعدةٍ حقيقية. وما بقي هنا لا تصنعه قاعدةٌ سليمة: رقم تسجيلٍ
 * فارغ، ومشرفٌ بلا اسم، وورقةٌ زال موضوعها (الحذف يتسلسل إليها)، وتصادمُ
 * رقمٍ فريد بين طلبين متزامنين. فيُصنع بقاعدةٍ مزيّفة.
 */
jest.mock("../../core/prisma/client", () => ({
  prisma: {
    graduationTopic: { findUnique: jest.fn() },
    // The sheet's saved words: none here — the original's.
    siteContent: { findUnique: jest.fn().mockResolvedValue(null) },
    supervisionDocument: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../core/prisma/client";
import { tr } from "../../core/i18n";
import {
  ean13CheckDigit,
  getSupervisionDocumentService,
  issueSupervisionDocumentService,
  previewSupervisionDocumentService,
} from "./supervision.service";

const db = prisma as unknown as {
  graduationTopic: { findUnique: jest.Mock };
  supervisionDocument: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
};

const admin = { userId: "admin-1", role: "admin" as const };
const professor = { userId: "prof-user", role: "professor" as const };

/** طالبٌ في المجموعة. */
const member = (reg: string, names: Record<string, string | null> = { firstName: "سارة", lastName: "قاسمي" }) => ({
  student: { userId: `u-${reg}`, registrationNumber: reg, user: names },
});

/** موضوعٌ كما يقرؤه `topicForDocument`. */
const topic = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  title: "عنوان",
  professor: { userId: "prof-user", user: { firstName: "يوسف", lastName: "حمادي" } },
  specialization: { name: "علم الاجتماع", level: "master" },
  academicYear: { title: "2026/2027" },
  projectGroup: { members: [member("202131012345")] },
  ...over,
});

/** خطأ القيد الفريد كما يرميه Prisma. */
const unique = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

beforeEach(() => {
  for (const group of Object.values(db)) for (const fn of Object.values(group)) (fn as jest.Mock).mockReset();
  db.supervisionDocument.findFirst.mockResolvedValue(null);
});

describe("ean13CheckDigit", () => {
  it("يحسب رقم التحقّق كما يحسبه القارئ الشريطيّ", () => {
    expect(ean13CheckDigit("290000000000")).toBe(1); // 2·1 + 9·3 = 29 ⇒ 10 − 9
    expect(ean13CheckDigit("400638133393")).toBe(1); // 4006381333931، رمزٌ تجاريّ معروف
  });
});

describe("لقطة الورقة — ما يمنع إصدارها", () => {
  it("طالبٌ بلا رقم تسجيل ⇒ لا ورقة، ويُقال كم طالباً", async () => {
    db.graduationTopic.findUnique.mockResolvedValue(
      topic({ projectGroup: { members: [member("202131012345"), member("  "), member("")] } }),
    );
    await expect(previewSupervisionDocumentService("t1", admin)).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("طالبان"), // اثنان بلا رقم، بصيغة المثنّى
    });
  });

  it("مشرفٌ بلا اسمٍ بأيّ لغة ⇒ لا ورقة", async () => {
    db.graduationTopic.findUnique.mockResolvedValue(
      topic({ professor: { userId: "prof-user", user: { firstName: null, lastName: null, firstNameLatin: null, lastNameLatin: null } } }),
    );
    await expect(previewSupervisionDocumentService("t1", admin)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("ومن لا اسم عربيّ له يُكتب باللاتينية؛ ومن لا اسم له أصلاً برقم تسجيله", async () => {
    db.graduationTopic.findUnique.mockResolvedValue(
      topic({
        professor: { userId: "prof-user", user: { firstName: null, lastName: null, firstNameLatin: "Youcef", lastNameLatin: "HAMADI" } },
        specialization: null,
        academicYear: null,
        projectGroup: { members: [member("202131012345", { firstNameLatin: "Sara", lastNameLatin: "KACEMI" }), member("202131099999", {})] },
      }),
    );
    const { snapshot, active } = await previewSupervisionDocumentService("t1", professor);
    expect(snapshot.supervisorName).toBe("Youcef HAMADI");
    expect(snapshot.students.map((s) => s.fullName)).toEqual(["Sara KACEMI", "202131099999"]);
    // تخصّصٌ أو سنةٌ زالا: حقلٌ فارغ، لا عطل.
    expect([snapshot.level, snapshot.specialization, snapshot.academicYear]).toEqual(["", "", ""]);
    expect(active).toBeNull();
  });

  it("وطالبٌ بلا حسابٍ مقروء يُردّ بلا صلاحية", async () => {
    db.graduationTopic.findUnique.mockResolvedValue(topic({ projectGroup: null }));
    await expect(
      previewSupervisionDocumentService("t1", { userId: "someone", role: "student" }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("ورقةٌ زال موضوعها", () => {
  beforeEach(() => {
    db.supervisionDocument.findUnique.mockResolvedValue({ id: "d1", topicId: "gone", barcode: "2900000000008" });
    db.graduationTopic.findUnique.mockResolvedValue(null);
  });

  it("تقرؤها الإدارة وحدها", async () => {
    await expect(getSupervisionDocumentService("d1", admin)).resolves.toMatchObject({ id: "d1" });
  });

  it("ولا يُقال لغيرها إنها موجودة", async () => {
    await expect(getSupervisionDocumentService("d1", professor)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("رقمٌ فريد يسبق إليه طلبٌ آخر", () => {
  beforeEach(() => db.graduationTopic.findUnique.mockResolvedValue(topic()));

  it("الإصدار يعيد المحاولة برقمٍ جديد", async () => {
    db.supervisionDocument.findFirst
      .mockResolvedValueOnce(null) // لا ورقة فعّالة
      .mockResolvedValueOnce({ documentNumber: `SUP-${new Date().getFullYear()}-000041` })
      .mockResolvedValueOnce({ documentNumber: `SUP-${new Date().getFullYear()}-000042` });
    db.supervisionDocument.create.mockRejectedValueOnce(unique()).mockImplementation(({ data }) => Promise.resolve({ id: "d2", ...data }));

    const { document, created } = await issueSupervisionDocumentService("t1", admin);
    expect(created).toBe(true);
    expect(db.supervisionDocument.create).toHaveBeenCalledTimes(2);
    expect(document.documentNumber).toBe(`SUP-${new Date().getFullYear()}-000043`);
  });

  /**
   * وبعد خمس محاولاتٍ يستسلم برسالته هو. كان يُعيد خطأ القيد الخام، فيصل
   * المستخدمَ «قيمةٌ مكرّرة في documentNumber» — حقلٌ لم يكتبه أحد.
   */
  it("وبعد خمس محاولاتٍ يستسلم برسالةٍ تقول ما جرى", async () => {
    db.supervisionDocument.create.mockRejectedValue(unique());
    await expect(issueSupervisionDocumentService("t1", admin)).rejects.toMatchObject({
      statusCode: 400,
      message: tr("supervision.numberFailed"),
    });
    expect(db.supervisionDocument.create).toHaveBeenCalledTimes(5);
  });

  it("وخطأٌ غير التصادم لا يُعاد عليه", async () => {
    db.supervisionDocument.create.mockRejectedValue(new Error("db down"));
    await expect(issueSupervisionDocumentService("t1", admin)).rejects.toThrow("db down");
    expect(db.supervisionDocument.create).toHaveBeenCalledTimes(1);
  });

  it("والرمز الشريطيّ لورقةٍ قديمة كذلك: يعيد عند التصادم، ولا يعيد عند غيره", async () => {
    // Issued before the barcode — and so before prints were kept: taken as printed, it does not follow its topic.
    db.supervisionDocument.findFirst.mockResolvedValue({ id: "d1", barcode: null, status: "active", printedAt: new Date("2026-01-01") });
    db.supervisionDocument.update
      .mockRejectedValueOnce(unique())
      .mockImplementation(({ data }) => Promise.resolve({ id: "d1", barcode: data.barcode }));
    const { active } = await previewSupervisionDocumentService("t1", admin);
    expect(active!.barcode).toMatch(/^29\d{11}$/);
    expect(db.supervisionDocument.update).toHaveBeenCalledTimes(2);

    db.supervisionDocument.update.mockReset().mockRejectedValue(new Error("db down"));
    await expect(previewSupervisionDocumentService("t1", admin)).rejects.toThrow("db down");

    // وخمس تصادماتٍ متتالية: يستسلم ولا يدور بلا نهاية.
    db.supervisionDocument.update.mockReset().mockRejectedValue(unique());
    await expect(previewSupervisionDocumentService("t1", admin)).rejects.toMatchObject({ code: "P2002" });
    expect(db.supervisionDocument.update).toHaveBeenCalledTimes(5);
  });
});

describe("قبل الطباعة", () => {
  const stored = (over: Record<string, unknown> = {}) => ({
    id: "d1",
    topicId: "t1",
    barcode: "2900000000008",
    status: "active",
    printedAt: null,
    printedById: null,
    snapshot: null as unknown,
    ...over,
  });

  it("ورقةٌ لم تُطبع تتبع موضوعها، ولا تُكتب إن لم يتغيّر شيء", async () => {
    db.graduationTopic.findUnique.mockResolvedValue(topic({ title: "عنوانٌ مصحَّح" }));
    db.supervisionDocument.findUnique.mockResolvedValue(stored({ snapshot: { topicTitle: "عنوان", issuedAt: "2026-09-01T00:00:00.000Z" } }));
    db.supervisionDocument.updateMany.mockResolvedValue({ count: 1 });
    const doc = await getSupervisionDocumentService("d1", admin);
    expect((doc.snapshot as { topicTitle: string; issuedAt: string }).topicTitle).toBe("عنوانٌ مصحَّح");
    // Issued when it was issued, whatever was refreshed after.
    expect((doc.snapshot as { issuedAt: string }).issuedAt).toBe("2026-09-01T00:00:00.000Z");
    expect(db.supervisionDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1", status: "active", printedAt: null } }),
    );
    // Read again, as it is now: nothing to write.
    db.supervisionDocument.findUnique.mockResolvedValue(stored({ snapshot: doc.snapshot }));
    db.supervisionDocument.updateMany.mockClear();
    await getSupervisionDocumentService("d1", admin);
    expect(db.supervisionDocument.updateMany).not.toHaveBeenCalled();
  });

  it("وموضوعٌ لم يعد يصنع ورقة يتركها على آخر ما كانت، بلا خطأ", async () => {
    db.graduationTopic.findUnique.mockResolvedValue(topic({ projectGroup: { members: [] } }));
    db.supervisionDocument.findUnique.mockResolvedValue(stored({ snapshot: { topicTitle: "عنوان" } }));
    const doc = await getSupervisionDocumentService("d1", admin);
    expect(doc.snapshot).toEqual({ topicTitle: "عنوان" });
    expect(db.supervisionDocument.updateMany).not.toHaveBeenCalled();
  });

  it("ولا يخرج من الخادم حسابُ من طبعها", async () => {
    db.graduationTopic.findUnique.mockResolvedValue(topic());
    db.supervisionDocument.findUnique.mockResolvedValue(
      stored({ printedAt: new Date(), printedById: "admin-1", printedByRole: "admin", printedByName: "موظّف", snapshot: {} }),
    );
    const forAdmin = await getSupervisionDocumentService("d1", admin);
    expect(forAdmin).not.toHaveProperty("printedById");
    expect(forAdmin.printedByName).toBe("موظّف");
    expect((await getSupervisionDocumentService("d1", professor)).printedByName).toBeNull();
  });
});
