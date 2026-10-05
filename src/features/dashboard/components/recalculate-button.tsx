"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recalculateHealthAction } from "@/features/accounts/actions";

export function RecalculateButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await recalculateHealthAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(`Recalculated ${result.data.accountsProcessed} health scores — ${result.data.scoresChanged} changed.`);
          router.refresh();
        })
      }
    >
      {!pending && <RefreshCw />} Recalculate
    </Button>
  );
}
