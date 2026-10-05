"use client";

import { SEGMENTS } from "@/config/health";
import { Checkbox } from "@/components/ui/checkbox";

export function SegmentCheckboxes({ idPrefix, value, onChange, disabled }: { idPrefix: string; value: string[]; onChange: (v: Array<(typeof SEGMENTS)[number]>) => void; disabled?: boolean }) {
  return (
    <fieldset className="mb-3.5" disabled={disabled}>
      <legend className="mb-1.5 text-xs font-semibold text-foreground-muted">Account access</legend>
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => {
          const id = `${idPrefix}-${s}`;
          const checked = value.includes(s);
          return (
            <label key={s} htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1.5 text-[12.5px]">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(c) => onChange(SEGMENTS.filter((x) => (x === s ? c === true : value.includes(x))))}
              />
              {s}
            </label>
          );
        })}
      </div>
      <p className="mt-1 text-[11.5px] text-foreground-faint">Leave all unchecked for access to every segment.</p>
    </fieldset>
  );
}
