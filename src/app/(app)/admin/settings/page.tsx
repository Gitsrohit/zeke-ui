import { Building2, Settings } from "lucide-react";
import { Card } from "@/components/shared/card";
import { Pill } from "@/components/shared/pill";
import { SectionTitle } from "@/components/shared/section-title";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { getWorkspaceSettings } from "@/features/settings/services/settings.service";
import { getServiceContext, requireSession } from "@/lib/auth/session";
import { can } from "@/lib/server/context";

export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const [session, ctx] = await Promise.all([requireSession(), getServiceContext()]);
  const settings = await getWorkspaceSettings(ctx);

  return (
    <>
      <SectionTitle icon={Settings} className="mt-0">
        Workflow settings
      </SectionTitle>
      <SettingsForm initial={settings} canEdit={can(ctx, "settings.manage")} />
      <SectionTitle icon={Building2}>Workspace</SectionTitle>
      <Card className="p-[18px]">
        <dl className="grid gap-4 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-label">Organization</dt>
            <dd className="mt-1 font-semibold">{session.organizationName}</dd>
          </div>
          <div>
            <dt className="text-label">Workspace</dt>
            <dd className="mt-1 font-semibold">{session.workspaceName ?? "Default workspace"}</dd>
          </div>
          <div>
            <dt className="text-label">Your role</dt>
            <dd className="mt-1">
              <Pill tone="neutral">{session.roleName}</Pill>
              {session.segmentScope.length > 0 && <span className="ml-2 text-xs text-foreground-faint">Access: {session.segmentScope.join(", ")}</span>}
            </dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
