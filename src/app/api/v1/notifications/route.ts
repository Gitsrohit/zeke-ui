import { NextResponse } from "next/server";
import { z } from "zod";
import { getNotificationFeed, markNotificationsRead } from "@/features/notifications/services/notification.service";
import { requireApiContext } from "@/lib/auth/session";
import { parseInput } from "@/lib/server/action";
import { withApi } from "@/lib/server/route";

export const GET = withApi(async () => {
  const ctx = await requireApiContext();
  const feed = await getNotificationFeed(ctx);
  return NextResponse.json({ unread: feed.unread, items: feed.items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null })) });
});

export const PATCH = withApi(async (request) => {
  const ctx = await requireApiContext();
  const { ids } = parseInput(z.object({ ids: z.array(z.string().uuid()).max(100).optional() }), await request.json());
  await markNotificationsRead(ctx, ids);
  return NextResponse.json({ ok: true });
});
