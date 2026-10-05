import type { HealthSourceKey } from "@/config/health";
import type { AgentStepNode, AgentTriggerType } from "@/features/agents/domain/types";

/** The default agent library provisioned into every new workspace. */
export interface AgentTemplate {
  key: string;
  name: string;
  category: string;
  targetMetric: HealthSourceKey;
  triggerType: AgentTriggerType;
  triggerLabel: string;
  description: string;
  cooldownDays: number;
  maxAttempts: number | null;
  eligibleLifecycles: string[];
  conflictsWith: string[];
  steps: AgentStepNode[];
}

let stepCounter = 0;
const id = () => `tpl-step-${++stepCounter}`;
const task = (title: string, dueInDays: number, ownerRole = "CSM", priority: "low" | "medium" | "high" = "medium"): AgentStepNode => ({
  id: id(),
  type: "task",
  config: { title, ownerRole, dueInDays, priority },
});
const email = (templateKey: string, requiresApproval = false): AgentStepNode => ({ id: id(), type: "email", config: { templateKey, requiresApproval } });
const wait = (duration: number, unit: "days" | "hours" = "days"): AgentStepNode => ({ id: id(), type: "wait", config: { duration, unit } });
const api = (method: "POST" | "PUT", endpoint: string, payload: string): AgentStepNode => ({ id: id(), type: "api", config: { method, endpoint, payload } });

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    key: "handover",
    name: "Handover CTA",
    category: "Adoption",
    targetMetric: "hygiene",
    triggerType: "event",
    triggerLabel: "Start date + 30 days (PS-to-CSM handover)",
    description: "Validates the PS-to-CSM handover, or self-onboarding checklist. If the customer hasn't engaged, sends education.",
    cooldownDays: 30,
    maxAttempts: null,
    eligibleLifecycles: [],
    conflictsWith: [],
    steps: [
      task("Review handover packet for completeness", 0),
      task("Verify portal login issued for key users", 2),
      email("welcome"),
      wait(8),
      {
        id: id(),
        type: "condition",
        config: { mode: "manual", label: "Has the customer engaged with onboarding?" },
        branches: { yes: [task("Log handover complete in the CRM", 1, "CSM", "low")], no: [email("self-onboard")] },
      },
      task("Close CTA and update Adoption stage status", 3, "CSM", "low"),
    ],
  },
  {
    key: "close-the-loop",
    name: "Close the Loop CTA",
    category: "Adoption",
    targetMetric: "survey",
    triggerType: "event",
    triggerLabel: "Detractor or negative-comment survey response",
    description: "Detractor follow-up after the onboarding survey, or a passive/promoter response with a negative comment.",
    cooldownDays: 14,
    maxAttempts: null,
    eligibleLifecycles: [],
    conflictsWith: [],
    steps: [
      task("Review survey score and verbatim comment", 0, "CSM", "high"),
      email("close-loop"),
      wait(3),
      task("Hold call to discuss concern and agree next steps", 2, "CSM", "high"),
      task("Log root cause and resolution", 1),
    ],
  },
  {
    key: "first-value-check",
    name: "First Value Check CTA",
    category: "Onboarding",
    targetMetric: "telemetry",
    triggerType: "event",
    triggerLabel: "Start date + 45 days",
    description: "Checks whether the customer has achieved first value against handover criteria; drives adoption via email if not.",
    cooldownDays: 20,
    maxAttempts: null,
    eligibleLifecycles: ["Onboarding"],
    conflictsWith: [],
    steps: [
      task("Review usage vs. first-value criteria", 0),
      {
        id: id(),
        type: "condition",
        config: { mode: "manual", label: "Has the customer achieved first value?" },
        branches: { yes: [task("Update first-value status in the CRM", 2, "CSM", "low")], no: [email("first-value"), email("self-serve")] },
      },
      wait(13),
      task("Schedule milestone call if still unmet", 2),
      task("Close CTA and record outcome", 1, "CSM", "low"),
    ],
  },
  {
    key: "adoption-risk",
    name: "Adoption Risk CTA",
    category: "Adoption",
    targetMetric: "telemetry",
    triggerType: "audience",
    triggerLabel: "Low serial / extraction token utilization",
    description: "Fires purely off usage data. Supplements with how-to and self-serve content, escalates if usage doesn't recover.",
    cooldownDays: 14,
    maxAttempts: null,
    eligibleLifecycles: [],
    conflictsWith: ["red-account-review"],
    steps: [
      task("Pull usage/utilization report", 0, "CSM", "high"),
      email("usage-dip"),
      email("office-hours"),
      wait(27),
      {
        id: id(),
        type: "condition",
        config: { mode: "manual", label: "Has usage recovered?" },
        branches: {
          yes: [task("Close CTA — recovered", 1, "CSM", "low")],
          no: [api("POST", "/v1/accounts/{id}/escalate", '{ "reason": "adoption_risk_unresolved", "assignTo": "DSM" }')],
        },
      },
    ],
  },
  {
    key: "version-update",
    name: "Version Update CTA",
    category: "Adoption",
    targetMetric: "telemetry",
    triggerType: "event",
    triggerLabel: "Customer 2+ versions behind latest release",
    description: "Encourages the customer to move to the latest version, with upgrade benefits highlighted.",
    cooldownDays: 60,
    maxAttempts: null,
    eligibleLifecycles: [],
    conflictsWith: [],
    steps: [email("new-version"), task("Share upgrade / installation guide", 1), wait(13), email("version-remind"), task("Confirm upgrade via version data, close CTA", 7, "CSM", "low")],
  },
  {
    key: "red-account-review",
    name: "Red Account Review (6-month)",
    category: "Growth",
    targetMetric: "crm",
    triggerType: "event",
    triggerLabel: "Red health score at 6 / 12 / 18 / 24 / 30 months",
    description: "Requires account planning from the DSM to move the account out of a red health score.",
    cooldownDays: 30,
    maxAttempts: null,
    eligibleLifecycles: [],
    conflictsWith: ["adoption-risk"],
    steps: [
      task("Pull health score breakdown and drivers", 0, "CSM/DSM", "high"),
      task("Internal account-planning session", 3, "DSM"),
      email("exec-checkin", true),
      task("Hold account review call, assign action items", 14, "CSM/DSM"),
      wait(135),
      task("Close cycle, schedule next Red Account Review", 1, "CSM/DSM", "low"),
    ],
  },
  {
    key: "renewal",
    name: "Renewal CTA",
    category: "Renewal",
    targetMetric: "renewal",
    triggerType: "event",
    triggerLabel: "120 days before renewal",
    description: "Evaluates customer health and creates an account summary; the AM uses this to drive the renewal conversation.",
    cooldownDays: 90,
    maxAttempts: null,
    eligibleLifecycles: [],
    conflictsWith: [],
    steps: [
      task("Pull health, usage and engagement summary", 0),
      email("renewal-kickoff"),
      {
        id: id(),
        type: "condition",
        config: { mode: "auto", label: "Is the account at risk?", field: "band", operator: "in", value: ["atRisk", "critical"] },
        branches: { yes: [task("Build a save plan with the AM", 2, "CSM/AM", "high")], no: [] },
      },
      task("Internal CSM/AM handoff meeting", 5, "CSM/AM"),
      email("roi-recap"),
      task("Schedule renewal discussion call", 30, "AM"),
    ],
  },
  {
    key: "escalation",
    name: "Escalation CTA (Adhoc)",
    category: "Escalation",
    targetMetric: "tickets",
    triggerType: "manual",
    triggerLabel: "Raised ad hoc by CSM, Support or the customer",
    description: "Handled manually and may require collaborating with stakeholders based on severity.",
    cooldownDays: 7,
    maxAttempts: null,
    eligibleLifecycles: [],
    conflictsWith: [],
    steps: [
      task("Log escalation details and severity", 0, "CSM", "high"),
      api("POST", "/v1/incidents", '{ "severity": "{{severity}}", "account": "{{account_id}}" }'),
      email("escalation-ack"),
      task("Coordinate resolution with cross-functional team", 3, "CSM", "high"),
      email("escalation-resolved"),
    ],
  },
  {
    key: "expansion-play",
    name: "Expansion Play",
    category: "Growth",
    targetMetric: "crm",
    triggerType: "audience",
    triggerLabel: "Growth-ready, renewal-adjacent, or promoter-signal accounts",
    description: "Opens an expansion conversation with accounts showing strong usage or advocacy signals — before the renewal cycle forces the conversation.",
    cooldownDays: 90,
    maxAttempts: 3,
    eligibleLifecycles: [],
    conflictsWith: [],
    steps: [
      task("Review usage against expansion-readiness criteria (seats, feature adoption, growth trend)", 0),
      email("growth"),
      task("Loop in AM to scope the expansion opportunity", 1, "CSM/AM"),
      wait(5),
      {
        id: id(),
        type: "condition",
        config: { mode: "manual", label: "Did the customer express interest?" },
        branches: { yes: [task("Schedule expansion scoping call with AM", 2, "AM", "high")], no: [task("Log as not-now; revisit next quarter", 1, "CSM", "low")] },
      },
    ],
  },
];
