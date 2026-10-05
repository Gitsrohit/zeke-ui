import { getHealthSource, HEALTH_BANDS, LIFECYCLE_STAGES, type HealthBandKey } from "@/config/health";
import { createStepNode, describeStepNode } from "@/features/agents/domain/steps";
import type { AgentStepNode } from "@/features/agents/domain/types";
import { nodeId } from "@/features/audiences/domain/builders";
import { describeCondition, evaluateAudience } from "@/features/audiences/domain/evaluate";
import type { AccountFacts, AudienceCondition, AudienceFilter } from "@/features/audiences/domain/types";
import { getExpansionCandidates } from "@/features/outcomes/domain/risk";
import { formatCurrency } from "@/lib/utils/format";
import type {
  AgentWorkflowResult,
  AIProvider,
  AssistantAnswer,
  AssistantContext,
  AudienceParseContext,
  AudienceParseResult,
} from "../types";

const num = (s: string) => {
  const m = s.replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)(k|m)?$/i);
  if (!m) return Number.NaN;
  const base = Number(m[1]);
  return m[2]?.toLowerCase() === "k" ? base * 1_000 : m[2]?.toLowerCase() === "m" ? base * 1_000_000 : base;
};

/** Deterministic natural-language → audience filter parser. Recognises the common CS phrasings. */
export function parseAudienceText(text: string, context: AudienceParseContext): Omit<AudienceParseResult, "provider"> {
  const t = text.toLowerCase();
  const conditions: AudienceCondition[] = [];
  const add = (c: Omit<AudienceCondition, "id">) => conditions.push({ id: nodeId("c"), ...c });
  let m: RegExpMatchArray | null;

  const stages = LIFECYCLE_STAGES.filter((l) => new RegExp(`\\b${l.toLowerCase()}\\b`).test(t));
  if (stages.length === 1) add({ field: "lifecycle", operator: "equals", value: stages[0] });
  else if (stages.length > 1) add({ field: "lifecycle", operator: "in", value: [...stages] });

  const segs: string[] = [];
  if (/\benterprise\b/.test(t)) segs.push("Enterprise");
  if (/mid[- ]market/.test(t)) segs.push("Mid-Market");
  if (/\bsmb\b|small business/.test(t)) segs.push("SMB");
  if (segs.length === 1) add({ field: "segment", operator: "equals", value: segs[0] });
  else if (segs.length > 1) add({ field: "segment", operator: "in", value: segs });

  const bands: HealthBandKey[] = [];
  if (/at[- ]risk/.test(t)) bands.push("atRisk");
  if (/\bcritical\b/.test(t)) bands.push("critical");
  if (/\bthriving\b|\bhealthy\b/.test(t)) bands.push("thriving");
  if (/\bstable\b/.test(t)) bands.push("stable");
  if (bands.length === 1) add({ field: "band", operator: "equals", value: bands[0] });
  else if (bands.length > 1) add({ field: "band", operator: "in", value: bands });

  const scoreRe = /(?:health(?:\s*score)?|score)\s*(?:is\s*)?(below|under|less than|above|over|greater than|more than)\s*(\d+)/;
  if ((m = t.match(scoreRe))) add({ field: "healthScore", operator: /below|under|less/.test(m[1]) ? "lessThan" : "greaterThan", value: Number(m[2]) });
  else if ((m = t.match(/(?:below|under|less than)\s*(\d+)(?!\s*(?:day|k\b|%))/))) add({ field: "healthScore", operator: "lessThan", value: Number(m[1]) });

  if ((m = t.match(/predictive risk\s*(?:score\s*)?(below|under|less than|above|over)\s*(\d+)/))) {
    add({ field: "predictiveRisk", operator: /below|under|less/.test(m[1]) ? "lessThan" : "greaterThan", value: Number(m[2]) });
  }
  if ((m = t.match(/(?:no meeting|haven.?t (?:had a )?met|haven.?t had a meeting|not met)\s*(?:in|for)\s*(?:the last\s*)?(\d+)\s*days?|last meeting (?:over|more than)\s*(\d+)/))) {
    add({ field: "lastMeetingDays", operator: "greaterThan", value: Number(m[1] ?? m[2]) });
  }
  if ((m = t.match(/(?:no login|not logged in|haven.?t logged in)\s*(?:in|for)\s*(?:the last\s*)?(\d+)\s*days?/))) {
    add({ field: "lastLoginDays", operator: "greaterThan", value: Number(m[1]) });
  }
  if ((m = t.match(/renew(?:ing|al|s)?\s*(?:within|in)\s*(?:the next\s*)?(\d+)\s*days?/))) {
    add({ field: "renewalInDays", operator: "lessThan", value: Number(m[1]) });
  }
  if ((m = t.match(/(?:more than|over|at least)\s*(\d+)\s*(?:open\s*)?tickets/))) add({ field: "openTickets", operator: "greaterThan", value: Number(m[1]) });
  if ((m = t.match(/nps\s*(?:score\s*)?(?:is\s*)?(below|under|less than|above|over|greater than)\s*(-?\d+)/))) {
    add({ field: "nps", operator: /below|under|less/.test(m[1]) ? "lessThan" : "greaterThan", value: Number(m[2]) });
  } else if (/\bdetractors?\b/.test(t)) add({ field: "nps", operator: "lessThan", value: 0 });
  else if (/\bpromoters?\b/.test(t)) add({ field: "nps", operator: "greaterThanOrEqual", value: 50 });
  if ((m = t.match(/arr\s*(?:is\s*)?(above|over|greater than|more than|below|under|less than)\s*\$?([\d.,]+\s*[km]?)/))) {
    const v = num(m[2]);
    if (Number.isFinite(v)) add({ field: "arr", operator: /above|over|greater|more/.test(m[1]) ? "greaterThan" : "lessThan", value: v });
  }
  for (const owner of context.owners) {
    const first = owner.name.split(" ")[0].toLowerCase();
    if (new RegExp(`\\b(owned by|for|csm)\\s+${first}\\b`).test(t) || t.includes(owner.name.toLowerCase())) {
      add({ field: "owner", operator: "equals", value: owner.id });
      break;
    }
  }

  const filter: AudienceFilter = { combinator: "or", groups: conditions.length ? [{ id: nodeId("g"), combinator: "and", conditions, groups: [] }] : [] };
  const names = Object.fromEntries(context.owners.map((o) => [o.id, o.name]));
  return {
    filter,
    explanation: conditions.length
      ? `I matched ${conditions.length} condition${conditions.length === 1 ? "" : "s"}: ${conditions.map((c) => describeCondition(c, { ownerNames: names })).join("; ")}. Review them before saving.`
      : `I couldn't pick out specific criteria — try mentioning a lifecycle stage, ARR segment, health score, or something like "no meeting in 30 days".`,
    confidence: conditions.length ? Math.min(0.9, 0.5 + conditions.length * 0.1) : 0,
    unmatched: [],
  };
}

/** Deterministic natural-language → workflow parser ("email, wait 3 days, then a task if they haven't logged in"). */
export function parseAgentText(text: string): Omit<AgentWorkflowResult, "provider"> {
  const clauses = text.split(/,|\bthen\b|\band then\b|;/i).map((c) => c.trim()).filter(Boolean);
  const steps: AgentStepNode[] = [];
  let branch: AgentStepNode[] | null = null;
  for (const raw of clauses) {
    const c = raw.toLowerCase();
    let m: RegExpMatchArray | null;
    const target = () => branch ?? steps;
    if (/^if\b|\bif\b/.test(c)) {
      const cond = createStepNode("condition");
      if (cond.type === "condition") {
        const question = raw.replace(/^.*?\bif\s+/i, "").replace(/\bhasn.?t|haven.?t/i, "has not").trim();
        cond.config = { mode: "manual", label: question ? `${question.charAt(0).toUpperCase()}${question.slice(1)}?` : "Condition met?" };
        const action = raw.slice(0, raw.toLowerCase().indexOf(" if")).trim();
        steps.push(cond);
        branch = cond.branches.yes;
        if (action) {
          const inner = parseAgentText(action).steps;
          branch.push(...inner);
        }
      }
      continue;
    }
    let node: AgentStepNode | null = null;
    if ((m = c.match(/wait\s+(\d+)\s*(day|days|hour|hours)/))) node = { id: nodeId("s"), type: "wait", config: { duration: Number(m[1]), unit: m[2].startsWith("hour") ? "hours" : "days" } };
    else if (c.includes("approv")) node = { id: nodeId("s"), type: "approval", config: { title: "Manager approval", approverRole: "CS Manager" } };
    else if (c.includes("email")) {
      const key = /re-?engag|usage/.test(c) ? "usage-dip" : /renew/.test(c) ? "renewal-kickoff" : /welcome|onboard/.test(c) ? "welcome" : /exec/.test(c) ? "exec-checkin" : /expan|grow/.test(c) ? "growth" : "office-hours";
      node = { id: nodeId("s"), type: "email", config: { templateKey: key, requiresApproval: false } };
    } else if (/call the|\bapi\b|escalat|webhook/.test(c)) node = { id: nodeId("s"), type: "api", config: { method: "POST", endpoint: "/v1/accounts/{id}/escalate", payload: '{ "reason": "agent_condition" }' } };
    else if (/task|call|follow up|review/.test(c)) {
      const title = raw.replace(/^(then\s+)?(create|add)\s+a\s+task(\s+for\s+the\s+\w+)?(\s+to)?\s*/i, "").trim() || "Follow up with the customer";
      node = { id: nodeId("s"), type: "task", config: { title: title.charAt(0).toUpperCase() + title.slice(1), ownerRole: "CSM", dueInDays: 2, priority: "medium" } };
    } else if (/\bstop\b|\bend\b/.test(c)) node = { id: nodeId("s"), type: "stop", config: { reason: "" } };
    if (node) target().push(node);
  }
  const flat = steps.map((s) => describeStepNode(s));
  return {
    steps,
    explanation: steps.length
      ? `Built a ${steps.length}-step sequence: ${flat.join(" → ")}. Review each step in the builder before saving.`
      : `I couldn't map that to steps — try naming actions like "email", "wait 3 days", "task" or "call the API", in order.`,
  };
}

function listAccounts(accounts: AccountFacts[], detail: (a: AccountFacts) => string, limit = 8) {
  return accounts.slice(0, limit).map((a) => ({ id: a.id, name: a.name, detail: detail(a) }));
}

function encodeFilter(filter: AudienceFilter): string {
  return Buffer.from(JSON.stringify(filter)).toString("base64url");
}

function answer(context: AssistantContext, question: string): Omit<AssistantAnswer, "provider"> {
  const q = question.toLowerCase();
  const byName = context.accounts
    .filter((a) => q.includes(a.name.toLowerCase()) || q.includes(a.name.toLowerCase().split(" ")[0]))
    .sort((a, b) => b.name.length - a.name.length)[0];

  if (byName && /why|score|health|explain|summar|tell me about|how is/.test(q)) {
    const band = HEALTH_BANDS[byName.band].label;
    const weakest = byName.weakestSource ? getHealthSource(byName.weakestSource).name : "an unknown source";
    return {
      answer: `${byName.name} scores ${byName.healthScore} (${band}). The biggest drag is ${weakest}. Predictive risk is ${byName.predictiveRisk}${byName.healthScore - byName.predictiveRisk > 12 ? ", well below the score — this may get worse before the score shows it" : ""}. ${byName.renewalInDays !== null ? `Renews in ${byName.renewalInDays} days. ` : ""}Open the account for the full source-by-source breakdown.`,
      accounts: listAccounts([byName], (a) => `${a.lifecycle} · ${a.segment} · ${formatCurrency(a.arr)}`),
      suggestedAction: { label: "Explain this score", href: `/score-dashboard?account=${byName.id}` },
    };
  }
  if (/renew/.test(q)) {
    const days = Number(q.match(/(\d+)\s*days?/)?.[1] ?? 90);
    const list = context.accounts.filter((a) => a.renewalInDays !== null && a.renewalInDays <= days).sort((a, b) => (a.renewalInDays ?? 0) - (b.renewalInDays ?? 0));
    const atRisk = list.filter((a) => a.band === "atRisk" || a.band === "critical");
    return {
      answer: list.length
        ? `${list.length} account${list.length === 1 ? "" : "s"} renew within ${days} days (${formatCurrency(list.reduce((s, a) => s + a.arr, 0))} ARR). ${atRisk.length} of them are At Risk or Critical.`
        : `No accounts renew in the next ${days} days.`,
      accounts: listAccounts(list, (a) => `${a.renewalInDays}d · ${HEALTH_BANDS[a.band].label} · ${formatCurrency(a.arr)}`),
      suggestedAction: list.length ? { label: "Build this audience", href: `/audiences/new?filter=${encodeFilter({ combinator: "or", groups: [{ id: "g", combinator: "and", conditions: [{ id: "c", field: "renewalInDays", operator: "lessThan", value: days }], groups: [] }] })}` } : null,
    };
  }
  if (/expan|upsell|grow/.test(q)) {
    const groups = getExpansionCandidates(context.accounts);
    const unique = [...new Map(groups.flatMap((g) => g.accounts).map((a) => [a.id, a])).values()];
    return {
      answer: `${unique.length} accounts show expansion signals across ${groups.filter((g) => g.accounts.length).length} opportunity types. Estimated potential is ${formatCurrency(groups.reduce((s, g) => s + g.estimatedPotential, 0))} — an illustrative estimate, not a forecast.`,
      accounts: listAccounts(unique, (a) => `${HEALTH_BANDS[a.band].label} · NPS ${a.nps ?? "—"} · ${formatCurrency(a.arr)}`),
      suggestedAction: { label: "Review expansion opportunities", href: "/outcomes?tab=expansion" },
    };
  }
  const parsed = parseAudienceText(question, { owners: context.owners });
  const parsedConditions = parsed.filter.groups.flatMap((g) => g.conditions);
  // A bare "which accounts are at risk?" means At Risk *and* Critical — answer it as a risk question.
  const onlyBand = parsedConditions.length === 1 && parsedConditions[0].field === "band";
  if (parsed.filter.groups.length && !(onlyBand && /risk|churn|attention|trouble/.test(q))) {
    const matches = evaluateAudience(context.accounts, parsed.filter);
    return {
      answer: `${matches.length} account${matches.length === 1 ? "" : "s"} match. ${parsed.explanation}`,
      accounts: listAccounts(matches, (a) => `Score ${a.healthScore} · ${a.lifecycle} · ${a.segment}`),
      suggestedAction: { label: "Open in Audience Creator", href: `/audiences/new?filter=${encodeFilter(parsed.filter)}` },
    };
  }
  if (/risk|churn|worst|attention|trouble/.test(q)) {
    const list = context.accounts.filter((a) => a.band === "atRisk" || a.band === "critical").sort((a, b) => a.healthScore - b.healthScore);
    return {
      answer: `${list.length} accounts are At Risk or Critical, representing ${formatCurrency(list.reduce((s, a) => s + a.arr, 0))} ARR. Drive Outcome groups them by root cause with a recommended agent for each.`,
      accounts: listAccounts(list, (a) => `Score ${a.healthScore} · ${a.weakestSource ? getHealthSource(a.weakestSource).shortName : "—"} · ${formatCurrency(a.arr)}`),
      suggestedAction: { label: "Open Drive Outcome", href: "/outcomes" },
    };
  }
  return {
    answer: `I can answer questions about your book of business. Try: "Which accounts are at risk?", "Why is Meridian Health Systems' score low?", "Who renews in the next 90 days?", or describe an audience like "Enterprise accounts in Adoption with health score below 60".`,
    accounts: [],
    suggestedAction: null,
  };
}

/** Offline provider: deterministic, explainable, and always available. */
export class RuleBasedAIProvider implements AIProvider {
  readonly name = "rule-based" as const;

  async parseAudience(prompt: string, context: AudienceParseContext): Promise<AudienceParseResult> {
    return { ...parseAudienceText(prompt, context), provider: this.name };
  }

  async generateAgentWorkflow(prompt: string): Promise<AgentWorkflowResult> {
    return { ...parseAgentText(prompt), provider: this.name };
  }

  async explainHealthScore(input: Parameters<AIProvider["explainHealthScore"]>[0]) {
    const sorted = [...input.contributions].sort((a, b) => b.pointsLost - a.pointsLost);
    const weakest = sorted[0];
    const strongest = [...input.contributions].sort((a, b) => b.score - a.score)[0];
    const name = (k: typeof weakest.source) => getHealthSource(k).name;
    return {
      headline: `${input.facts.name} scores ${input.facts.healthScore} — ${HEALTH_BANDS[input.facts.band].label}.`,
      observations: [
        `${name(weakest.source)} scores ${weakest.score} at a ${weakest.weight}% weight, costing ${weakest.pointsLost.toFixed(1)} points.`,
        `${name(sorted[1].source)} is next, costing ${sorted[1].pointsLost.toFixed(1)} points.`,
        `Strongest source: ${name(strongest.source)} (${strongest.score}).`,
        `Score moved ${input.trendDelta >= 0 ? "+" : ""}${input.trendDelta} points over ~90 days.`,
      ],
      inference:
        input.facts.healthScore - input.facts.predictiveRisk > 12
          ? `Predictive risk (${input.facts.predictiveRisk}) is running well below the score, so this account may deteriorate before the score reflects it.`
          : `Improving ${name(weakest.source)} would move the score the most.`,
      weakestSource: weakest.source,
    };
  }

  async generateRootCause(input: Parameters<AIProvider["generateRootCause"]>[0]) {
    return input.rootCause;
  }

  async recommendAction(rootCause: Parameters<AIProvider["recommendAction"]>[0]) {
    return { action: rootCause.recommendedAction, agentKey: rootCause.recommendedAgentKey };
  }

  async summarizeAccount(input: Parameters<AIProvider["summarizeAccount"]>[0]) {
    const weakest = [...input.contributions].sort((a, b) => b.pointsLost - a.pointsLost)[0];
    const f = input.facts;
    const parts = [
      `${f.name} is a ${f.segment} account in ${f.lifecycle} with ${formatCurrency(f.arr)} ARR, scoring ${f.healthScore} (${HEALTH_BANDS[f.band].label}).`,
      weakest ? `${getHealthSource(weakest.source).name} is the weakest signal (${weakest.score}).` : "",
      f.renewalInDays !== null ? `Renewal is in ${f.renewalInDays} days.` : "",
      f.lastMeetingDays !== null ? `Last meeting ${f.lastMeetingDays} days ago.` : "",
      input.activeAgentNames.length ? `Active agents: ${input.activeAgentNames.join(", ")}.` : "No agents running.",
      input.openWorkItems ? `${input.openWorkItems} open work item${input.openWorkItems === 1 ? "" : "s"}.` : "",
    ];
    return parts.filter(Boolean).join(" ");
  }

  async answerQuestion(question: string, context: AssistantContext): Promise<AssistantAnswer> {
    return { ...answer(context, question), provider: this.name };
  }
}

