"use client";

import { CalendarPlus, ListPlus, Mail, MoreHorizontal, Pencil, Play, StickyNote } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LaunchAgentDialog, type LaunchableAgent } from "@/features/agents/components/launch-agent-dialog";
import { AccountFormDialog } from "./account-form-dialog";
import type { AccountFilterOptions } from "./accounts-table";
import type { AccountFormValues } from "./schemas";
import { TaskDialog, type TaskDialogMode } from "./task-dialog";

interface AccountActionsProps {
  accountId: string;
  accountName: string;
  canWrite: boolean;
  canWork: boolean;
  canLaunch: boolean;
  agents: LaunchableAgent[];
  recommendedAgentId: string | null;
  options: AccountFilterOptions;
  formValues: AccountFormValues;
}

export function AccountActions({ accountId, accountName, canWrite, canWork, canLaunch, agents, recommendedAgentId, options, formValues }: AccountActionsProps) {
  const [taskMode, setTaskMode] = useState<TaskDialogMode | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canWrite && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/accounts/${accountId}?tab=notes#new-note`} scroll={false}>
            <StickyNote /> Add note
          </Link>
        </Button>
      )}
      {canWork && (
        <Button variant="outline" size="sm" onClick={() => setTaskMode("task")}>
          <ListPlus /> Create task
        </Button>
      )}
      {canLaunch && (
        <Button variant="accent" size="sm" onClick={() => setLaunchOpen(true)}>
          <Play /> Launch agent
        </Button>
      )}
      {(canWork || canWrite) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="More account actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canWork && (
              <>
                <DropdownMenuItem onSelect={() => setTaskMode("email")}>
                  <Mail /> Send email
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTaskMode("meeting")}>
                  <CalendarPlus /> Schedule meeting
                </DropdownMenuItem>
              </>
            )}
            {canWork && canWrite && <DropdownMenuSeparator />}
            {canWrite && (
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil /> Edit account
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {taskMode && <TaskDialog open onOpenChange={(o) => !o && setTaskMode(null)} accountId={accountId} accountName={accountName} mode={taskMode} />}
      {launchOpen && (
        <LaunchAgentDialog open onOpenChange={setLaunchOpen} accountIds={[accountId]} agents={agents} defaultAgentId={recommendedAgentId} sourceLabel="Account detail" description={`for ${accountName}`} />
      )}
      {editOpen && <AccountFormDialog open onOpenChange={setEditOpen} options={options} account={{ id: accountId, values: formValues }} />}
    </div>
  );
}
