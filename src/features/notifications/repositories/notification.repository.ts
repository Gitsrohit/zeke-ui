import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";

export type NotificationInsert = Omit<typeof notifications.$inferInsert, "id" | "createdAt" | "readAt">;

export async function insertNotifications(executor: DbExecutor, values: NotificationInsert[]): Promise<void> {
  if (values.length) await executor.insert(notifications).values(values);
}

export async function listNotifications(executor: DbExecutor, organizationId: string, userId: string, limit = 20) {
  return executor
    .select()
    .from(notifications)
    .where(and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnread(executor: DbExecutor, organizationId: string, userId: string): Promise<number> {
  const [{ total }] = await executor
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId), isNull(notifications.readAt)));
  return total;
}

export async function markRead(executor: DbExecutor, organizationId: string, userId: string, ids?: string[]): Promise<void> {
  await executor
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        ids ? inArray(notifications.id, ids) : undefined,
      ),
    );
}
