import { SearchX } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title="We couldn't find that"
        description="It may have been deleted, or you may not have access to it."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </Card>
  );
}
