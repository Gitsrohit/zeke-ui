"use client";

import { useEffect } from "react";
import { Card } from "@/components/shared/card";
import { ErrorState } from "@/components/shared/error-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the digest so support can correlate with server logs.
    document.title = "Error · Zeke AI";
  }, [error]);
  return (
    <Card>
      <ErrorState description={`This page failed to load.${error.digest ? ` Reference: ${error.digest}` : ""}`} onRetry={reset} />
    </Card>
  );
}
