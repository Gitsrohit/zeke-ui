import { NextResponse } from "next/server";
import { getAccountsPage } from "@/features/accounts/services/account.service";
import { requireApiContext } from "@/lib/auth/session";
import { withApi } from "@/lib/server/route";
import { accountQueryFromParams } from "./query";

export const GET = withApi(async (request) => {
  const ctx = await requireApiContext();
  return NextResponse.json(await getAccountsPage(ctx, accountQueryFromParams(new URL(request.url).searchParams)));
});
