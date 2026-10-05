import { NextResponse } from "next/server";
import { getMemberActivity } from "@/features/users/services/user.service";
import { requireApiContext } from "@/lib/auth/session";
import { withApi } from "@/lib/server/route";

export const GET = withApi<RouteContext<"/api/v1/users/[membershipId]/activity">>(async (request, context) => {
  const ctx = await requireApiContext();
  const { membershipId } = await context.params;
  const days = Number(new URL(request.url).searchParams.get("days") ?? 30);
  return NextResponse.json(await getMemberActivity(ctx, membershipId, days));
});
