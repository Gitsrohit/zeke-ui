"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recalculateAllAction } from "../actions";

export function RecalculateButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await recalculateAllAction();
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          const { accountsProcessed, scoresChanged, bandChanges } = result.data;
          toast.success(`Recalculated ${accountsProcessed} accounts — ${scoresChanged} scores changed, ${bandChanges} band changes.`);
          router.refresh();
        })
      }
    >
      {!pending && <RefreshCw />} Recalculate all
    </Button>
  );
}
