import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processDueWaits } from "@/features/agents/services/agent-engine.service";
import { env } from "@/lib/env";
import { UnauthorizedError } from "@/lib/errors";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { systemContext } from "@/lib/server/context";
import { withApi } from "@/lib/server/route";

function authorized(request: Request): boolean {
  const secret = env().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Scheduler entry point — call every few minutes with `Authorization: Bearer $CRON_SECRET`. */
export const POST = withApi(async (request) => {
  if (!authorized(request)) throw new UnauthorizedError("Invalid scheduler credentials");
  const resumed = await processDueWaits((org) => systemContext(org, ROLE_PERMISSIONS.owner));
  return NextResponse.json({ resumed });
});
