import { NextResponse } from "next/server";
import { previewAudience } from "@/features/audiences/services/audience.service";
import { requireApiContext } from "@/lib/auth/session";
import { withApi } from "@/lib/server/route";

export const POST = withApi(async (request) => {
  const ctx = await requireApiContext();
  return NextResponse.json(await previewAudience(ctx, await request.json()));
});
