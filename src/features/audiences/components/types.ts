import type { LaunchableAgent } from "@/features/agents/components/launch-agent-dialog";

export interface OwnerOption {
  id: string;
  name: string;
}

export interface BuilderContext {
  owners: OwnerOption[];
  agents: LaunchableAgent[];
  canManage: boolean;
  canLaunch: boolean;
  totalAccounts: number;
}

/** Shape of AccountFacts as serialised to the client by preview / AI endpoints. */
export interface MatchedAccount {
  id: string;
  name: string;
  lifecycle: string;
  segment: string;
  band: "thriving" | "stable" | "atRisk" | "critical";
  healthScore: number;
  arr: number;
  ownerName: string | null;
}
