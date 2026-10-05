import type { AccountFacts } from "@/features/audiences/domain/types";
import type { AccountRow } from "@/features/accounts/repositories/account.repository";
import { daysSince, daysUntil } from "@/lib/utils/dates";

/** Maps a persisted account row to the evaluable facts used by audiences, outcomes and agents. */
export function toAccountFacts(row: AccountRow, now: Date = new Date()): AccountFacts {
  return {
    id: row.id,
    name: row.name,
    lifecycle: row.lifecycle,
    segment: row.segment,
    band: row.band ?? "critical",
    healthScore: row.score ?? 0,
    predictiveRisk: row.predictiveRisk ?? 0,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    lastMeetingDays: daysSince(row.lastMeetingAt, now),
    lastLoginDays: daysSince(row.lastLoginAt, now),
    openTickets: row.openTickets,
    nps: row.nps,
    renewalInDays: daysUntil(row.renewalDate, now),
    arr: row.arr,
    weakestSource: row.weakestSource,
  };
}
