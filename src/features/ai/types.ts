import type { HealthSourceKey } from "@/config/health";
import type { AgentStepNode } from "@/features/agents/domain/types";
import type { AccountFacts, AudienceFilter } from "@/features/audiences/domain/types";
import type { SourceContribution } from "@/features/health/domain/score";
import type { RootCause } from "@/features/outcomes/domain/risk";

export interface AudienceParseContext {
  owners: Array<{ id: string; name: string }>;
}

export interface AudienceParseResult {
  filter: AudienceFilter;
  explanation: string;
  /** 0–1. Low confidence means the user should review carefully. */
  confidence: number;
  /** Phrases the provider could not map to a filter. */
  unmatched: string[];
  provider: AIProviderName;
}

export interface AgentWorkflowResult {
  steps: AgentStepNode[];
  explanation: string;
  provider: AIProviderName;
}

export interface HealthExplanationInput {
  facts: AccountFacts;
  contributions: SourceContribution[];
  thresholds: { thriving: number; stable: number; atRisk: number };
  trendDelta: number;
}

export interface HealthExplanation {
  headline: string;
  /** Observable facts, each traceable to data. */
  observations: string[];
  /** Model inference — not guaranteed. */
  inference: string;
  weakestSource: HealthSourceKey;
}

export interface AccountSummaryInput {
  facts: AccountFacts;
  contributions: SourceContribution[];
  activeAgentNames: string[];
  openWorkItems: number;
  recentNotes: string[];
}

export interface AssistantContext {
  accounts: AccountFacts[];
  owners: Array<{ id: string; name: string }>;
  userName: string;
}

export interface AssistantAnswer {
  answer: string;
  accounts: Array<{ id: string; name: string; detail: string }>;
  /** Navigation only — the assistant never executes actions itself. */
  suggestedAction: { label: string; href: string } | null;
  provider: AIProviderName;
}

export type AIProviderName = "rule-based" | "anthropic";

/**
 * Abstraction over AI capabilities. Implementations must return structured,
 * reviewable results; nothing here performs side effects.
 */
export interface AIProvider {
  readonly name: AIProviderName;
  parseAudience(prompt: string, context: AudienceParseContext): Promise<AudienceParseResult>;
  generateAgentWorkflow(prompt: string): Promise<AgentWorkflowResult>;
  explainHealthScore(input: HealthExplanationInput): Promise<HealthExplanation>;
  generateRootCause(input: { facts: AccountFacts; rootCause: RootCause }): Promise<RootCause>;
  recommendAction(rootCause: RootCause): Promise<{ action: string; agentKey: string }>;
  summarizeAccount(input: AccountSummaryInput): Promise<string>;
  answerQuestion(question: string, context: AssistantContext): Promise<AssistantAnswer>;
}
