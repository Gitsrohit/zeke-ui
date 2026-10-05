import {
  countUnread,
  insertNotifications,
  listNotifications,
  markRead,
  type NotificationInsert,
} from "@/features/notifications/repositories/notification.repository";
import { db, type DbExecutor } from "@/lib/db/client";
import type { ServiceContext } from "@/lib/server/context";

export async function notifyUsers(executor: DbExecutor, values: NotificationInsert[]): Promise<void> {
  // Never notify the actor about their own action, and collapse duplicates.
  const seen = new Set<string>();
  const unique = values.filter((v) => {
    const key = `${v.userId}:${v.type}:${v.href}:${v.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  await insertNotifications(executor, unique);
}

export async function getNotificationFeed(ctx: ServiceContext) {
  if (!ctx.userId) return { items: [], unread: 0 };
  const [items, unread] = await Promise.all([
    listNotifications(db, ctx.organizationId, ctx.userId),
    countUnread(db, ctx.organizationId, ctx.userId),
  ]);
  return { items, unread };
}

export async function markNotificationsRead(ctx: ServiceContext, ids?: string[]): Promise<void> {
  if (!ctx.userId) return;
  await markRead(db, ctx.organizationId, ctx.userId, ids);
}
