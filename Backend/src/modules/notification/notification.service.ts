import { prisma } from "../../core/prisma/client";
import { Prisma, NotificationType, Role } from "../../generated/prisma";

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

export interface NotifyInput {
  userId: string;
  type?: NotificationType;
  title: string;
  message: string;
  link?: string;
}

// Create a single notification for one user.
export const createNotification = async (
  input: NotifyInput,
  db: Db = prisma,
) => {
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type ?? "general",
      title: input.title,
      message: input.message,
      link: input.link,
    },
  });
};

// Create many notifications at once (e.g. notify every group member).
export const createNotifications = async (
  inputs: NotifyInput[],
  db: Db = prisma,
) => {
  if (inputs.length === 0) return { count: 0 };
  return db.notification.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      type: i.type ?? "general",
      title: i.title,
      message: i.message,
      link: i.link,
    })),
  });
};

// Notify every ACTIVE user that has one of the given roles.
// Use this for "a professor proposed a topic" → notify all admins/owner.
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

// Convenience: notify all admins + the owner.
export const notifyAdmins = (
  input: Omit<NotifyInput, "userId">,
  db: Db = prisma,
) => notifyRoles(["admin", "owner"], input, db);

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

  return { items, total, unread, page, limit };
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
