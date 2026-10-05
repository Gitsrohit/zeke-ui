import { NextResponse } from "next/server";
import { globalSearch } from "@/features/search/services/search.service";
import { requireApiContext } from "@/lib/auth/session";
import { withApi } from "@/lib/server/route";

export const GET = withApi(async (request) => {
  const ctx = await requireApiContext();
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json(await globalSearch(ctx, q));
});
