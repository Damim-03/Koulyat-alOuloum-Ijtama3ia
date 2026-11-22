/**
 * الرسائل — ما لا تصنعه قاعدةٌ سليمة.
 *
 * القواعد نفسها تُختبر على قاعدةٍ حقيقية (tests/api/messages*.api.test.ts).
 * وما هنا هو ما تحرسه الخدمة ولا يقع إلّا حين يختلّ شيء: حسابٌ بلا ملفّ
 * طالبٍ أو أستاذ، مرسِلٌ زال أو عُطّل بين طلبين، علاقاتٌ فارغة، رسالةٌ اختفت
 * بين كتابتها وقراءتها. فيُصنع بقاعدةٍ مزيّفة: يجب ألّا يصير أيٌّ منها ٥٠٠.
 */
jest.mock("../../core/prisma/client", () => {
  const fn = () => jest.fn();
  return {
    prisma: {
      user: { findUnique: fn(), findMany: fn(), count: fn() },
      student: { findUnique: fn(), findMany: fn() },
      professor: { findUnique: fn(), findMany: fn() },
      message: { findMany: fn(), findUnique: fn() },
      messageRecipient: { findMany: fn(), createMany: fn(), groupBy: fn() },
      messageAttachment: { findMany: fn() },
      $transaction: fn(),
    },
  };
});

import { prisma } from "../../core/prisma/client";
import {
  contactsService,
  conversationsService,
  getMessageService,
  mayWrite,
  sendMessageService,
} from "./messages.service";

type Mocked = Record<string, Record<string, jest.Mock>> & { $transaction: jest.Mock };
const db = prisma as unknown as Mocked;

const ME = "me-user";
const active = (id: string, role: string) => ({ id, role, status: "active" });
const lite = (id: string, role = "student") => ({
  id,
  firstName: null,
  lastName: null,
  firstNameLatin: null,
  lastNameLatin: null,
  avatarUrl: null,
  gender: null,
  role,
});

beforeEach(() => {
  for (const [key, group] of Object.entries(db)) {
    if (key === "$transaction") (group as unknown as jest.Mock).mockReset();
    else for (const m of Object.values(group)) m.mockReset();
  }
  db.message.findMany.mockResolvedValue([]);
  db.messageRecipient.findMany.mockResolvedValue([]);
  db.messageRecipient.groupBy.mockResolvedValue([]);
  db.messageAttachment.findMany.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
  db.user.count.mockResolvedValue(0);
});

describe("المرسِل", () => {
  it("حسابٌ زال بين الدخول والإرسال ⇒ 404، لا 500", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(sendMessageService(ME, { recipientIds: ["x"], body: "b" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("وحسابٌ عُطّل ⇒ 400", async () => {
    db.user.findUnique.mockResolvedValue({ ...lite(ME, "admin"), status: "suspended" });
    await expect(sendMessageService(ME, { recipientIds: ["x"], body: "b" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("وأستاذٌ بلا ملفّ أستاذ لا يراسل طالباً", async () => {
    db.user.findUnique.mockResolvedValue({ ...lite(ME, "professor"), status: "active" });
    db.user.findMany.mockResolvedValue([active("s1", "student")]);
    db.professor.findUnique.mockResolvedValue(null);
    await expect(sendMessageService(ME, { recipientIds: ["s1"], body: "b" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("ورسالةٌ كُتبت ثمّ اختفت قبل أن تُقرأ ⇒ 404", async () => {
    db.user.findUnique.mockResolvedValue({ ...lite(ME, "admin"), status: "active" });
    db.user.findMany.mockResolvedValue([active("s1", "student")]);
    const created = { id: "m1", threadId: null, subject: null, body: "b", broadcast: null, createdAt: new Date() };
    db.$transaction.mockImplementation((work: (tx: unknown) => unknown) =>
      work({ message: { create: async () => created }, messageRecipient: { createMany: async () => ({ count: 1 }) } }),
    );
    db.message.findUnique.mockResolvedValue(null);
    await expect(sendMessageService(ME, { recipientIds: ["s1"], body: "b" })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("جهات الاتّصال", () => {
  it("حسابٌ لا وجود له ⇒ 404", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(contactsService(ME, { limit: 12 })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("طالبٌ بلا ملفّ طالب ⇒ 400", async () => {
    db.user.findUnique.mockResolvedValue({ role: "student" });
    db.student.findUnique.mockResolvedValue(null);
    await expect(contactsService(ME, { limit: 12 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("وعلاقاتٌ فارغة (مجموعةٌ أو موضوعٌ أو طلبٌ زال) لا تُدخل أحداً ولا تُسقط شيئاً", async () => {
    db.user.findUnique.mockResolvedValue({ role: "student" });
    db.student.findUnique.mockResolvedValue({
      projectMembers: [{ group: null }, { group: { topic: null, members: [{ student: null }] } }],
      ledGroupRequests: [{ topic: null, members: null }],
      groupRequestMembers: [{ request: null }, { request: { topic: { professor: null }, leader: null, members: null } }],
    });
    const res = await contactsService(ME, { limit: 12 });
    expect(res.items).toEqual([]);
    const where = db.user.findMany.mock.calls[0]![0].where;
    expect(JSON.stringify(where)).toContain('"id":{"in":[]}');
  });

  it("وأستاذٌ بلا ملفّ أستاذ: الإدارة والأساتذة وحدهم", async () => {
    db.user.findUnique.mockResolvedValue({ role: "professor" });
    db.professor.findUnique.mockResolvedValue(null);
    await contactsService(ME, { limit: 12 });
    expect(db.student.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(db.user.findMany.mock.calls[0]![0].where)).toContain('"id":{"in":[]}');
  });

  it("والإدارة ترى ما يُعرف به كلٌّ: رقم التسجيل، أو بريد الجامعة، أو البريد", async () => {
    db.user.findUnique.mockResolvedValue({ role: "admin" });
    db.user.findMany.mockResolvedValue([
      { ...lite("s", "student"), email: null, student: { registrationNumber: "R1", specialization: { name: "Spec" } }, professor: null },
      { ...lite("p", "professor"), email: null, student: null, professor: { universityEmail: "p@u.dz", department: { name: "Dept" } } },
      { ...lite("a", "admin"), email: "a@u.dz", student: null, professor: null },
      { ...lite("n", "admin"), email: null, student: null, professor: null },
    ]);
    const res = await contactsService(ME, { limit: 12, search: "a", role: "admin" });
    expect(res.items.map((c) => c.handle)).toEqual(["R1", "p@u.dz", "a@u.dz", null]);
    expect(res.items.map((c) => c.detail)).toEqual(["Spec", "Dept", null, null]);
    expect(res.items.map((c) => c.relation)).toEqual(["student", "professor", "admin", "admin"]);
  });
});

describe("mayWrite — لشريط «يكتب…» ولزرّ الإرسال", () => {
  it("لا أحد يكتب لنفسه", async () => {
    expect(await mayWrite(ME, ME)).toBe(false);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("ولا إلى حسابٍ زال أو عُطّل", async () => {
    db.user.findUnique.mockResolvedValueOnce(active(ME, "admin")).mockResolvedValueOnce(null);
    expect(await mayWrite(ME, "gone")).toBe(false);
    db.user.findUnique.mockResolvedValueOnce(active(ME, "admin")).mockResolvedValueOnce({ id: "s", role: "student", status: "suspended" });
    expect(await mayWrite(ME, "s")).toBe(false);
  });

  it("والإدارة إلى أيّ أحد؛ والطالب لا إلى غريب", async () => {
    db.user.findUnique.mockResolvedValueOnce(active(ME, "admin")).mockResolvedValueOnce(active("s", "student"));
    expect(await mayWrite(ME, "s")).toBe(true);

    db.user.findUnique.mockResolvedValueOnce(active(ME, "student")).mockResolvedValueOnce(active("s", "student"));
    db.student.findUnique.mockResolvedValue({ projectMembers: [], ledGroupRequests: [], groupRequestMembers: [] });
    expect(await mayWrite(ME, "s")).toBe(false);
  });
});

describe("قائمة المحادثات", () => {
  it("حسابٌ لا وجود له ⇒ 404", async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(conversationsService(ME)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("رسائلي لنفسي لا تصنع محادثة، والأحدث يُزيح الأقدم أيّاً كان مرسِله، ورسالةٌ أخيرة زالت ⇒ بلا معاينة", async () => {
    const t = (min: number) => new Date(Date.UTC(2026, 9, 26, 10, min));
    db.user.findUnique.mockResolvedValue({ role: "admin" });
    db.messageRecipient.findMany.mockResolvedValue([
      { readAt: null, message: { id: "self", senderId: ME, createdAt: t(9) } },
      { readAt: t(8), message: { id: "a-new", senderId: "a", createdAt: t(5) } },
      { readAt: null, message: { id: "a-old", senderId: "a", createdAt: t(1) } },
    ]);
    db.message.findMany
      .mockResolvedValueOnce([
        { id: "to-a", createdAt: t(7), recipients: [{ userId: "a", readAt: t(8) }] },
        { id: "to-b", createdAt: t(3), recipients: [{ userId: ME, readAt: null }, { userId: "b", readAt: null }] },
      ])
      .mockResolvedValueOnce([
        { id: "to-a", subject: "s", body: "ردّي", broadcast: null, createdAt: t(7), attachments: [], _count: { attachments: 0 } },
      ]);
    db.user.findMany.mockResolvedValue([
      { ...lite("a", "student"), status: "active", lastLoginAt: null, student: { registrationNumber: "R1", specialization: null }, professor: null },
      { ...lite("b", "professor"), status: "active", lastLoginAt: null, student: null, professor: { department: null } },
    ]);

    const res = await conversationsService(ME);
    const by = Object.fromEntries(res.items.map((i) => [i.user.id, i]));
    expect(Object.keys(by).sort()).toEqual(["a", "b"]);
    // ردّي (7) أحدث من آخر ما كتبه (5): هو آخر المحادثة، وقد قرأه.
    expect(by.a!.last).toMatchObject({ id: "to-a", mine: true, read: true, preview: "ردّي", file: null });
    expect(by.a!.unread).toBe(1);
    expect(by.a!.user.handle).toBe("R1");
    expect(by.b!.last).toBeNull();
    expect(by.b!.user.handle).toBeNull();
    expect(res.unread).toBe(1);
  });
});

describe("فتح رسالة", () => {
  it("رسالةٌ ليست في أوّل مئتين من محادثتها تُفتح وحدها، بعنوانها", async () => {
    const m = {
      id: "m9",
      senderId: ME,
      subject: "عنوانها",
      body: "b",
      broadcast: null,
      threadId: "root",
      replyToId: "root",
      createdAt: new Date(),
      sender: lite(ME, "admin"),
      _count: { recipients: 1 },
    };
    db.message.findUnique
      .mockResolvedValueOnce({ id: "m9", senderId: ME, threadId: "root", recipients: [] }) // visible
      .mockResolvedValueOnce(m); // shapeOne
    db.message.findMany.mockResolvedValue([]);
    const res = await getMessageService(ME, "m9");
    expect(res.message.id).toBe("m9");
    expect(res.thread).toEqual([]);
    expect(res.subject).toBe("عنوانها");
  });
});
