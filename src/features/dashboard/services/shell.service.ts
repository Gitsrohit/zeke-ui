import { countAccounts } from "@/features/accounts/repositories/account.repository";
import { getRiskCount } from "@/features/outcomes/services/outcome.service";
import { getOpenWorkCount } from "@/features/work/services/work.service";
import { db } from "@/lib/db/client";
import type { ServiceContext } from "@/lib/server/context";

/** Badge counts and workspace facts for the application shell. */
export async function getShellData(ctx: ServiceContext) {
  const [work, risk, accountCount] = await Promise.all([getOpenWorkCount(ctx), getRiskCount(ctx), countAccounts(db, ctx)]);
  return { counts: { work, risk }, accountCount };
}
