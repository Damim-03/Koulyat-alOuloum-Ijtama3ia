import { prisma } from "../../core/prisma/client";
import { Prisma, NotificationType, Role } from "../../generated/prisma";
import { pushNotification, emitToUsers } from "../../core/realtime/realtime";
import { LANGS, currentLang, tr, type Lang, type MessageKey, type Params } from "../../core/i18n";

/**
 * Reusable notification layer.
 *
 * Any module (admin / professor / student) can create notifications, and the
 * read/list helpers power the in-app bell. Each "create" helper accepts an
 * optional Prisma transaction client (`db`) so notifications can be written
 * atomically inside an existing `$transaction`.
 */

// Either the singleton client or a transaction client.
type Db = Prisma.TransactionClient | typeof prisma;

/** نصٌّ من فهرس الرسائل بقيمه — يُكتب باللغات الثلاث. */
export interface NotifyText {
  key: MessageKey;
  params?: Params;
}

export interface NotifyInput {
  userId: string;
  type?: NotificationType;
  title: NotifyText;
  message: NotifyText;
  link?: string;
}

/**
 * الإشعار باللغات الثلاث، وبالعربية في عمودَي العنوان والرسالة (لما يقرأ
 * بلا لغة). فالقارئ يراه بلغة واجهته — ولو كتبه فعلُ غيره بلغةٍ أخرى.
 */
function written(input: NotifyInput) {
  const i18n = Object.fromEntries(
    LANGS.map((lang) => [
      lang,
      {
        title: tr(input.title.key, input.title.params, lang),
        message: tr(input.message.key, input.message.params, lang),
      },
    ]),
  ) as Record<Lang, { title: string; message: string }>;
  return { title: i18n.ar.title, message: i18n.ar.message, i18n };
}

// Create a single notification for one user.
export const createNotification = async (
  input: NotifyInput,
  db: Db = prisma,
) => {
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type ?? "general",
      ...written(input),
      link: input.link,
    },
  });
  // Straight to the recipient's bell — no poll, no refresh.
  pushNotification(input.userId, notification);
  emitToUsers([input.userId], "notifications", "created", notification.id);
  return notification;
};

// Create many notifications at once (e.g. notify every group member).
export const createNotifications = async (
  inputs: NotifyInput[],
  db: Db = prisma,
) => {
  if (inputs.length === 0) return { count: 0 };
  const result = await db.notification.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      type: i.type ?? "general",
      ...written(i),
      link: i.link,
    })),
  });
  // createMany returns no rows, so nudge each recipient to refetch the bell.
  emitToUsers([...new Set(inputs.map((i) => i.userId))], "notifications", "created");
  return result;
};

// Notify every ACTIVE user that has one of the given roles.
// Use this for "a professor proposed a topic" → notify every admin.
export const notifyRoles = async (
  roles: Role[],
  input: Omit<NotifyInput, "userId">,
  db: Db = prisma,
) => {
  const users = await db.user.findMany({
    where: { role: { in: roles }, status: "active" },
    select: { id: true },
  });
  return createNotifications(
    users.map((u) => ({ ...input, userId: u.id })),
    db,
  );
};

// Convenience: notify every admin.
export const notifyAdmins = (
  input: Omit<NotifyInput, "userId">,
  db: Db = prisma,
) => notifyRoles(["admin"], input, db);

/**
 * إشعارُ الإدارة لا يُفشِل ما تسبّب فيه.
 *
 * حين يُنادى هذا يكون الموضوع أو الطلب قد كُتب وثبت. فلو سقط الإشعار — قاعدةٌ
 * تعثّرت، أو مديرٌ حُذف بين الاستعلام والكتابة — لعاد فعلٌ **ناجح** إلى صاحبه
 * بـ٥٠٠، فأعاد المحاولة، فأنشأ الشيء مرّتين. والإشعار الضائع أهون من موضوعٍ
 * مكرّر بكثير.
 *
 * ويُسجَّل السقوط ولا يُبتلع صامتاً: جرسٌ توقّف عن العمل بلا أثرٍ في السجلّ
 * لا يلاحظه أحد حتى تسأل الإدارة لماذا لا يصلها شيء.
 *
 * و`await` مقصود رغم أن النتيجة مُهمَلة: الترتيب يبقى محدَّداً، فيقرأ
 * الاختبار الأثر بعد الردّ مباشرةً بلا انتظارٍ عشوائي.
 */
export const notifyAdminsQuietly = (
  input: Omit<NotifyInput, "userId">,
  db: Db = prisma,
) => quietly("notifyAdmins", input, () => notifyAdmins(input, db));

/**
 * القاعدة نفسها لأيّ دور: إشعار الأساتذة بفترة اقتراح المواضيع لا يُفشِل
 * حفظ الفترة. و`scope` ما يُسجَّل به السقوط.
 */
export const notifyRolesQuietly = (
  roles: Role[],
  input: Omit<NotifyInput, "userId">,
  scope: string,
  db: Db = prisma,
) => quietly(scope, input, () => notifyRoles(roles, input, db));

async function quietly(
  scope: string,
  input: Omit<NotifyInput, "userId">,
  send: () => Promise<{ count: number }>,
) {
  try {
    return await send();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        scope,
        title: input.title.key,
        message: (error as Error)?.message,
      }),
    );
    return { count: 0 };
  }
}

//
// ─── READ SIDE (the bell) ─────────────────────────────────────
//

interface ListNotificationsArgs {
  page?: number;
  limit?: number;
  onlyUnread?: boolean;
}

// Paginated list of a single user's notifications + the unread total.
export const listNotificationsService = async (
  userId: string,
  { page = 1, limit = 20, onlyUnread = false }: ListNotificationsArgs = {},
) => {
  const where = { userId, ...(onlyUnread ? { isRead: false } : {}) };

  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  // بلغة القارئ: ما كُتب باللغات الثلاث يُقرأ بلغة واجهته، وما سبق ذلك بالعربية.
  const lang = currentLang();
  const read = items.map((n) => {
    const own = (n.i18n as Record<string, { title?: string; message?: string }> | null)?.[lang];
    return { ...n, title: own?.title ?? n.title, message: own?.message ?? n.message };
  });

  return { items: read, total, unread, page, limit };
};

export const unreadCountService = async (userId: string) => {
  const unread = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unread };
};

// Mark one notification as read (only if it belongs to this user).
export const markNotificationReadService = async (
  userId: string,
  id: string,
) => {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
  return { updated: result.count };
};

export const markAllNotificationsReadService = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
};
