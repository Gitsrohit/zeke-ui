"use client";

import { Archive, ArrowLeft, Lock, Play, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useReducer, useState, useTransition } from "react";
import { toast } from "sonner";
import type { HealthSourceKey } from "@/config/health";
import { FormError } from "@/components/forms/field";
import { Card } from "@/components/shared/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { archiveAgentAction, saveAgentAction } from "@/features/agents/actions";
import { createStepNode, validateStepTree } from "@/features/agents/domain/steps";
import { AGENT_CATEGORIES, type AgentCategory, type AgentStepNode, type AgentTriggerType } from "@/features/agents/domain/types";
import { AgentAiPanel } from "./agent-ai-panel";
import { BuilderSettings, TRIGGER_DEFAULT_LABELS, type BuilderMeta } from "./builder-settings";
import { FlowCanvas } from "./flow-canvas";
import { LaunchAgentDialog } from "./launch-agent-dialog";
import { StepConfigPanel } from "./step-config-panel";
import { findStep, stepTreeReducer } from "./step-tree";

export interface BuilderAgent {
  id: string | null;
  name: string;
  description: string;
  category: string;
  status: "active" | "draft" | "archived";
  triggerType: AgentTriggerType;
  triggerLabel: string;
  targetMetric: HealthSourceKey;
  audienceId: string | null;
  cooldownDays: number;
  maxAttempts: number | null;
  eligibleLifecycles: string[];
  conflictsWith: string[];
}

interface AgentBuilderProps {
  agent: BuilderAgent;
  initialSteps: AgentStepNode[];
  otherAgents: Array<{ id: string; name: string }>;
  audiences: Array<{ id: string; name: string; memberCount: number }>;
  canManage: boolean;
  canLaunch: boolean;
  /** Members of the saved attached audience, resolved on the server. */
  launchTarget: { audienceId: string; audienceName: string; memberIds: string[] } | null;
}

export const NEW_AGENT: BuilderAgent = {
  id: null,
  name: "Untitled agent",
  description: "",
  category: "Adoption",
  status: "draft",
  triggerType: "manual",
  triggerLabel: TRIGGER_DEFAULT_LABELS.manual,
  targetMetric: "telemetry",
  audienceId: null,
  cooldownDays: 14,
  maxAttempts: null,
  eligibleLifecycles: [],
  conflictsWith: [],
};

export function AgentBuilder({ agent, initialSteps, otherAgents, audiences, canManage, canLaunch, launchTarget }: AgentBuilderProps) {
  const router = useRouter();
  const readOnly = !canManage || agent.status === "archived";
  const [steps, dispatch] = useReducer(stepTreeReducer, initialSteps);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [category, setCategory] = useState(agent.category);
  const [status, setStatus] = useState<"active" | "draft">(agent.status === "active" ? "active" : "draft");
  const [meta, setMeta] = useState<BuilderMeta>({
    triggerType: agent.triggerType,
    triggerLabel: agent.triggerLabel,
    audienceId: agent.audienceId,
    targetMetric: agent.targetMetric,
    cooldownDays: String(agent.cooldownDays),
    maxAttempts: agent.maxAttempts === null ? "" : String(agent.maxAttempts),
    eligibleLifecycles: agent.eligibleLifecycles,
    conflictsWith: agent.conflictsWith,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverStepErrors, setServerStepErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [archiving, startArchive] = useTransition();

  const selected = selectedId ? findStep(steps, selectedId) : null;
  const stepErrors = useMemo(() => validateStepTree(steps), [steps]);
  const touch = () => {
    setDirty(true);
    setServerError(null);
    setServerStepErrors([]);
  };

  const save = () =>
    startSave(async () => {
      if (steps.length === 0) {
        setServerError("Add at least one step before saving.");
        return;
      }
      if (stepErrors.length) {
        setServerError("Fix the step issues listed below before saving.");
        return;
      }
      const payload = {
        name,
        description,
        category,
        status,
        triggerType: meta.triggerType,
        triggerLabel: meta.triggerLabel,
        targetMetric: meta.targetMetric,
        audienceId: meta.audienceId,
        cooldownDays: Number(meta.cooldownDays),
        maxAttempts: meta.maxAttempts.trim() === "" ? null : Number(meta.maxAttempts),
        eligibleLifecycles: meta.eligibleLifecycles,
        conflictsWith: meta.conflictsWith,
        steps,
      };
      const result = await saveAgentAction(payload, agent.id ?? undefined);
      if (!result.ok) {
        setServerError(result.error);
        setServerStepErrors(result.fieldErrors?.steps ?? []);
        toast.error(result.error);
        return;
      }
      setDirty(false);
      toast.success(agent.id ? "Saved as a new version — runs in progress keep their version." : "Agent created.");
      if (!agent.id) router.push(`/agents/${result.data.id}`);
      else router.refresh();
    });

  const archive = () =>
    startArchive(async () => {
      if (!agent.id) return;
      const result = await archiveAgentAction(agent.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${agent.name} archived.`);
      router.push("/agents");
    });

  const canLaunchNow = canLaunch && Boolean(agent.id) && agent.status === "active" && !dirty && launchTarget !== null && launchTarget.memberIds.length > 0;
  const launchHint = !agent.id ? "Save the agent first" : agent.status !== "active" ? "Set status to Active and save to launch" : dirty ? "Save your changes before launching" : !launchTarget ? "Attach an audience and save to launch from here" : launchTarget.memberIds.length === 0 ? "The attached audience has no members" : undefined;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/agents">
            <ArrowLeft /> Library
          </Link>
        </Button>
        <label htmlFor="agent-name" className="sr-only">
          Agent name
        </label>
        <input
          id="agent-name"
          value={name}
          maxLength={100}
          disabled={readOnly}
          onChange={(e) => {
            setName(e.target.value);
            touch();
          }}
          className="min-w-[180px] flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-display text-[19px] font-semibold outline-none hover:border-border focus-visible:border-violet disabled:hover:border-transparent"
          aria-invalid={name.trim().length < 2 || undefined}
        />
        <Select
          value={category}
          disabled={readOnly}
          onValueChange={(v) => {
            setCategory(v as AgentCategory);
            touch();
          }}
        >
          <SelectTrigger aria-label="Category" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGENT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          disabled={readOnly}
          onValueChange={(v) => {
            setStatus(v as "active" | "draft");
            touch();
          }}
        >
          <SelectTrigger aria-label="Status" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        {!readOnly && (
          <Button onClick={save} loading={saving} variant="outline">
            {!saving && <Save />} {agent.id ? "Save version" : "Save agent"}
          </Button>
        )}
        {canLaunch && (
          <Button variant="accent" disabled={!canLaunchNow} title={launchHint} onClick={() => setLaunchOpen(true)}>
            <Play /> Launch
          </Button>
        )}
        {!readOnly && agent.id && (
          <Button variant="ghost" size="icon" aria-label="Archive agent" title="Archive agent" onClick={() => setArchiveOpen(true)}>
            <Archive />
          </Button>
        )}
      </div>

      {readOnly && (
        <p className="mb-4 flex items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-[12.5px] text-foreground-muted">
          <Lock className="size-3.5" aria-hidden />
          {agent.status === "archived" ? "This agent is archived and read-only." : "You can view this agent, but editing requires the agents.manage permission."}
        </p>
      )}
      {launchHint && canLaunch && !readOnly && <p className="mb-3 text-[11.5px] text-foreground-faint">Launch: {launchHint}.</p>}
      <FormError message={serverError} />

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Manual builder</TabsTrigger>
          <TabsTrigger value="ai">Ask Zeke</TabsTrigger>
        </TabsList>
        <TabsContent value="manual">
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="mb-3">
                <label htmlFor="agent-description" className="mb-1.5 block text-xs font-semibold text-foreground-muted">
                  Description
                </label>
                <Textarea
                  id="agent-description"
                  value={description}
                  maxLength={500}
                  disabled={readOnly}
                  placeholder="What this agent is for and when to use it"
                  className="min-h-[52px]"
                  onChange={(e) => {
                    setDescription(e.target.value);
                    touch();
                  }}
                />
              </div>
              <BuilderSettings
                meta={meta}
                readOnly={readOnly}
                audiences={audiences}
                otherAgents={otherAgents}
                onChange={(patch) => {
                  setMeta((m) => ({ ...m, ...patch }));
                  touch();
                }}
              />
              <div className="mt-1">
                <FlowCanvas
                  steps={steps}
                  selectedId={selectedId}
                  readOnly={readOnly}
                  onSelect={setSelectedId}
                  onAdd={(address, index, type) => {
                    const node = createStepNode(type);
                    dispatch({ type: "insert", address, index, node });
                    setSelectedId(node.id);
                    touch();
                  }}
                  onRemove={(id) => {
                    dispatch({ type: "remove", id });
                    if (selectedId === id) setSelectedId(null);
                    touch();
                  }}
                  onMove={(id, direction) => {
                    dispatch({ type: "move", id, direction });
                    touch();
                  }}
                />
              </div>
              {(stepErrors.length > 0 || serverStepErrors.length > 0) && (
                <div role="alert" className="mt-4 rounded-md border border-critical/30 bg-critical-tint px-3 py-2 text-[12.5px] text-critical">
                  <p className="font-semibold">Fix these before saving:</p>
                  <ul className="mt-1 list-disc pl-5">
                    {[...new Set([...stepErrors, ...serverStepErrors])].map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Card className="p-[18px] lg:sticky lg:top-0" aria-label="Step details">
              <StepConfigPanel
                step={selected}
                readOnly={readOnly}
                onChange={(config) => {
                  if (!selected) return;
                  dispatch({ type: "updateConfig", id: selected.id, config });
                  touch();
                }}
                onRemove={() => {
                  if (!selected) return;
                  dispatch({ type: "remove", id: selected.id });
                  setSelectedId(null);
                  touch();
                }}
              />
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="ai">
          <AgentAiPanel
            hasSteps={steps.length > 0}
            readOnly={readOnly}
            onApply={(next) => {
              dispatch({ type: "replace", steps: next });
              setSelectedId(null);
              touch();
              toast.info("Draft loaded into the Manual builder — review it, then Save.");
            }}
          />
        </TabsContent>
      </Tabs>

      {launchTarget && agent.id && (
        <LaunchAgentDialog
          open={launchOpen}
          onOpenChange={setLaunchOpen}
          accountIds={launchTarget.memberIds}
          agents={[{ id: agent.id, name: agent.name, category: agent.category }]}
          defaultAgentId={agent.id}
          audienceId={launchTarget.audienceId}
          sourceLabel={launchTarget.audienceName}
          description={`in ${launchTarget.audienceName}`}
        />
      )}
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${agent.name}?`}
        description="It disappears from the library and can't be launched. Runs already in progress continue to completion."
        confirmLabel="Archive"
        tone="destructive"
        loading={archiving}
        onConfirm={archive}
      />
    </div>
  );
}
