import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "./card";

export function PermissionDenied({ permission, description }: { permission?: string; description?: string }) {
  return (
    <Card className="flex flex-col items-center px-5 py-14 text-center">
      <Lock className="mb-3 size-8 stroke-[1.5] text-foreground-faint" aria-hidden />
      <h2 className="mb-1 text-sm font-semibold">You don&apos;t have access to this</h2>
      <p className="mx-auto max-w-[360px] text-[12.5px] text-foreground-muted">
        {description ?? "Your role doesn't include permission for this area. Ask a workspace admin if you need access."}
        {permission && (
          <>
            {" "}
            Required: <code className="font-mono text-[11.5px] text-foreground">{permission}</code>
          </>
        )}
      </p>
      <Button asChild variant="outline" size="sm" className="mt-4">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </Card>
  );
}
