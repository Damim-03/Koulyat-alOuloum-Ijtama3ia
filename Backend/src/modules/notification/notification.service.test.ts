/**
 * طبقة الإشعارات — بلا قاعدة بيانات.
 *
 * اختبار الـAPI (admin-bell) يمرّ بالمسار السعيد: إشعارٌ بنوعه يُكتب ويُقرأ.
 * وما بقي خارجه فروعٌ صغيرة تُنسى لأنها لا تفشل بصوت: إشعارٌ بلا نوع، وقائمةٌ
 * فارغة، ومعاملةٌ تُمرَّر أو لا تُمرَّر، وإشعارٌ للإدارة يسقط فلا يُسقط ما
 * تسبّب فيه، وجرسٌ يُقرأ بلغة قارئه أو بالعربية حين لا ترجمة.
 *
 * القاعدة والبثّ الحيّ مزيّفان: ما يُختبر هو ما تطلبه الطبقة منهما.
 */
import { tr, withLang } from "../../core/i18n";

jest.mock("../../core/prisma/client", () => ({
  prisma: {
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findMany: jest.fn() },
  },
}));
jest.mock("../../core/realtime/realtime", () => ({
  pushNotification: jest.fn(),
  emitToUsers: jest.fn(),
}));

import { prisma } from "../../core/prisma/client";
import { emitToUsers, pushNotification } from "../../core/realtime/realtime";
import {
  createNotification,
  createNotifications,
  listNotificationsService,
  markAllNotificationsReadService,
  markNotificationReadService,
  notifyAdmins,
  notifyAdminsQuietly,
  notifyRoles,
  unreadCountService,
} from "./notification.service";

const db = prisma as unknown as {
  notification: Record<"create" | "createMany" | "findMany" | "count" | "updateMany", jest.Mock>;
  user: { findMany: jest.Mock };
};

/** معاملةٌ مزيّفة بالشكل نفسه — لتُعرف القاعدة التي كُتب فيها فعلاً. */
const fakeTx = () =>
  ({
    notification: { create: jest.fn(async () => ({ id: "n-tx" })), createMany: jest.fn(async () => ({ count: 1 })) },
    user: { findMany: jest.fn(async () => [{ id: "a-tx" }]) },
  }) as unknown as Parameters<typeof createNotification>[1] & {
    notification: { create: jest.Mock; createMany: jest.Mock };
    user: { findMany: jest.Mock };
  };

const approved = {
  title: { key: "notif.topicApproved.title" as const },
  message: { key: "notif.topicApproved.message" as const, params: { title: "التنمية" } },
};

beforeEach(() => {
  jest.clearAllMocks();
  db.notification.create.mockResolvedValue({ id: "n-1" });
  db.notification.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
});

describe("createNotification", () => {
  it("بلا نوع ⇒ «general»، بالقاعدة الافتراضية، ويُكتب باللغات الثلاث ويصل الجرس فوراً", async () => {
    const row = await createNotification({ userId: "u-1", ...approved, link: "/topics/t-1" });

    const { data } = db.notification.create.mock.calls[0]![0];
    expect(data.type).toBe("general");
    expect(data.link).toBe("/topics/t-1");
    // العمودان بالعربية لما يُقرأ بلا لغة، والثلاث في `i18n`.
    expect(data.title).toBe(tr("notif.topicApproved.title", undefined, "ar"));
    expect(data.message).toBe(tr("notif.topicApproved.message", { title: "التنمية" }, "ar"));
    expect(data.i18n.en.message).toBe("The topic «التنمية» was approved.");
    expect(Object.keys(data.i18n).sort()).toEqual(["ar", "en", "fr"]);

    expect(pushNotification).toHaveBeenCalledWith("u-1", row);
    expect(emitToUsers).toHaveBeenCalledWith(["u-1"], "notifications", "created", "n-1");
  });

  it("وبنوعه، وفي المعاملة المُمرَّرة لا في القاعدة", async () => {
    const tx = fakeTx();
    await createNotification({ userId: "u-1", type: "security_alert", ...approved }, tx);

    expect(tx.notification.create.mock.calls[0]![0].data.type).toBe("security_alert");
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});

describe("createNotifications", () => {
  it("قائمةٌ فارغة ⇒ لا كتابة ولا بثّ", async () => {
    expect(await createNotifications([])).toEqual({ count: 0 });
    expect(db.notification.createMany).not.toHaveBeenCalled();
    expect(emitToUsers).not.toHaveBeenCalled();
  });

  it("دفعةٌ واحدة، والنوع الافتراضيّ لما لا نوع له، وكلّ مستلمٍ يُنبَّه مرّةً واحدة", async () => {
    const res = await createNotifications([
      { userId: "u-1", ...approved },
      { userId: "u-1", type: "security_alert", ...approved },
      { userId: "u-2", ...approved },
    ]);

    expect(res).toEqual({ count: 3 });
    const { data } = db.notification.createMany.mock.calls[0]![0];
    expect(data.map((d: { type: string }) => d.type)).toEqual(["general", "security_alert", "general"]);
    expect(emitToUsers).toHaveBeenCalledTimes(1);
    expect(emitToUsers).toHaveBeenCalledWith(["u-1", "u-2"], "notifications", "created");
  });

  it("وفي المعاملة المُمرَّرة", async () => {
    const tx = fakeTx();
    await createNotifications([{ userId: "u-1", ...approved }], tx);
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });
});

describe("notifyRoles / notifyAdmins", () => {
  it("الإدارة: كلّ مديرٍ نشط، بالقاعدة الافتراضية", async () => {
    db.user.findMany.mockResolvedValue([{ id: "a-1" }, { id: "a-2" }]);

    expect(await notifyAdmins(approved)).toEqual({ count: 2 });
    expect(db.user.findMany).toHaveBeenCalledWith({
      where: { role: { in: ["admin"] }, status: "active" },
      select: { id: true },
    });
    const { data } = db.notification.createMany.mock.calls[0]![0];
    expect(data.map((d: { userId: string }) => d.userId)).toEqual(["a-1", "a-2"]);
  });

  it("ولا أحد بهذا الدور ⇒ لا كتابة", async () => {
    db.user.findMany.mockResolvedValue([]);
    expect(await notifyRoles(["professor"], approved)).toEqual({ count: 0 });
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("والمعاملة تصل إلى الكتابة نفسها", async () => {
    const tx = fakeTx();
    await notifyRoles(["admin", "professor"], approved, tx);
    expect(tx.user.findMany.mock.calls[0]![0].where.role).toEqual({ in: ["admin", "professor"] });
    expect(tx.notification.createMany).toHaveBeenCalledTimes(1);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});

describe("notifyAdminsQuietly", () => {
  let logged: jest.SpyInstance;
  beforeEach(() => {
    logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => logged.mockRestore());

  it("ينجح كما ينجح notifyAdmins", async () => {
    db.user.findMany.mockResolvedValue([{ id: "a-1" }]);
    expect(await notifyAdminsQuietly(approved)).toEqual({ count: 1 });
    expect(logged).not.toHaveBeenCalled();
  });

  /**
   * الفعل الذي استدعاه قد ثبت؛ فإشعارٌ يسقط لا يُرجعه بـ٥٠٠ فيُعاد مرّتين.
   * والسقوط يُسجَّل بمفتاح العنوان — لا يُبتلع صامتاً.
   */
  it("وحين يسقط لا يرمي: يُسجّل السقوط ويقول «لا شيء»", async () => {
    db.user.findMany.mockRejectedValue(new Error("connection lost"));

    expect(await notifyAdminsQuietly(approved)).toEqual({ count: 0 });
    const line = JSON.parse(logged.mock.calls[0]![0]);
    expect(line).toMatchObject({
      level: "error",
      scope: "notifyAdmins",
      title: "notif.topicApproved.title",
      message: "connection lost",
    });
  });

  it("ولو رُمي ما ليس خطأً", async () => {
    const tx = fakeTx();
    tx.user.findMany.mockRejectedValue(undefined);
    expect(await notifyAdminsQuietly(approved, tx)).toEqual({ count: 0 });
    expect(JSON.parse(logged.mock.calls[0]![0]).message).toBeUndefined();
  });
});

describe("listNotificationsService — الجرس", () => {
  const row = (over: Record<string, unknown>) => ({
    id: "n",
    userId: "u-1",
    title: "عنوانٌ بالعربية",
    message: "رسالةٌ بالعربية",
    i18n: null,
    ...over,
  });

  beforeEach(() => {
    db.notification.findMany.mockResolvedValue([]);
    db.notification.count.mockResolvedValueOnce(7).mockResolvedValueOnce(3);
  });

  it("بلا خيارات: الصفحة الأولى، عشرون، والمقروء وغيره معاً", async () => {
    const res = await listNotificationsService("u-1");

    expect(db.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "u-1" },
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 20,
    });
    // عدد غير المقروء دائماً على كلّ الإشعارات، لا على الصفحة.
    expect(db.notification.count).toHaveBeenLastCalledWith({ where: { userId: "u-1", isRead: false } });
    expect(res).toEqual({ items: [], total: 7, unread: 3, page: 1, limit: 20 });
  });

  it("وغير المقروء وحده، في صفحةٍ أخرى", async () => {
    await listNotificationsService("u-1", { page: 3, limit: 5, onlyUnread: true });
    expect(db.notification.findMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: "u-1", isRead: false },
      skip: 10,
      take: 5,
    });
  });

  it("بلغة القارئ ما كُتب بها، وبالعربية ما لم يُكتب", async () => {
    db.notification.findMany.mockResolvedValue([
      row({ id: "full", i18n: { en: { title: "Approved", message: "It was approved" } } }),
      row({ id: "old", i18n: null }), // سبق الكتابة باللغات الثلاث
      row({ id: "other", i18n: { fr: { title: "Approuvé", message: "Approuvé" } } }),
      row({ id: "half", i18n: { en: { title: "Approved" } } }),
    ]);

    const { items } = await withLang("en", () => listNotificationsService("u-1"));
    const byId = Object.fromEntries(items.map((n) => [n.id, n]));

    expect(byId.full).toMatchObject({ title: "Approved", message: "It was approved" });
    expect(byId.old).toMatchObject({ title: "عنوانٌ بالعربية", message: "رسالةٌ بالعربية" });
    expect(byId.other).toMatchObject({ title: "عنوانٌ بالعربية", message: "رسالةٌ بالعربية" });
    expect(byId.half).toMatchObject({ title: "Approved", message: "رسالةٌ بالعربية" });
  });
});

describe("العدّاد والقراءة", () => {
  it("عدد غير المقروء لصاحبه", async () => {
    db.notification.count.mockResolvedValue(4);
    expect(await unreadCountService("u-1")).toEqual({ unread: 4 });
    expect(db.notification.count).toHaveBeenCalledWith({ where: { userId: "u-1", isRead: false } });
  });

  /** القيد على صاحب الإشعار في الاستعلام نفسه: معرّفُ إشعار غيره يُحدِّث صفراً. */
  it("قراءة إشعارٍ واحد لا تمسّ إلا إشعارات صاحبها", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 0 });
    expect(await markNotificationReadService("u-1", "n-of-someone-else")).toEqual({ updated: 0 });
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n-of-someone-else", userId: "u-1" },
      data: { isRead: true },
    });
  });

  it("وقراءة الكلّ", async () => {
    db.notification.updateMany.mockResolvedValue({ count: 5 });
    expect(await markAllNotificationsReadService("u-1")).toEqual({ updated: 5 });
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "u-1", isRead: false },
      data: { isRead: true },
    });
  });
});
