"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AccountFormDialog } from "./account-form-dialog";
import type { AccountFilterOptions } from "./accounts-table";

export function NewAccountButton({ options }: { options: AccountFilterOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> New account
      </Button>
      <AccountFormDialog open={open} onOpenChange={setOpen} options={options} />
    </>
  );
}
