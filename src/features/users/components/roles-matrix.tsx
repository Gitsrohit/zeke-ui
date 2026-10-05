import { Check, Minus } from "lucide-react";
import { PERMISSION_DESCRIPTIONS, PERMISSIONS, ROLE_KEYS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/permissions";

const ROLE_SUMMARIES: Record<(typeof ROLE_KEYS)[number], string> = {
  owner: "Full control, including other owners.",
  admin: "Full control except granting the Owner role.",
  cs_manager: "Runs the CS motion: scorecards, agents, audit.",
  csm: "Works their book: accounts, audiences, launches, queue.",
  viewer: "Read-only access to accounts and health.",
};

/** Collapsible permission matrix — every cell carries text/icon, never colour alone. */
export function RolesMatrix() {
  return (
    <details className="group mt-6 rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[14px] font-semibold marker:hidden">
        Roles &amp; permissions
        <span className="text-xs font-normal text-foreground-faint group-open:hidden">Show matrix</span>
        <span className="hidden text-xs font-normal text-foreground-faint group-open:inline">Hide matrix</span>
      </summary>
      <div className="overflow-x-auto border-t border-border scrollbar-thin">
        <table className="w-full border-collapse text-[12.5px]">
          <caption className="sr-only">Permissions granted to each role</caption>
          <thead>
            <tr>
              <th scope="col" className="text-label border-b border-border px-3 py-2.5 text-left">
                Permission
              </th>
              {ROLE_KEYS.map((r) => (
                <th key={r} scope="col" className="text-label border-b border-border px-3 py-2.5 text-center whitespace-nowrap">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
            <tr>
              <td className="border-b border-border px-3 py-2 text-[11.5px] text-foreground-faint">What the role is for</td>
              {ROLE_KEYS.map((r) => (
                <td key={r} className="border-b border-border px-3 py-2 text-center text-[11px] text-foreground-faint">
                  {ROLE_SUMMARIES[r]}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p}>
                <th scope="row" className="border-b border-border px-3 py-2 text-left font-normal">
                  <code className="font-mono text-[11.5px] text-foreground">{p}</code>
                  <div className="text-[11.5px] text-foreground-faint">{PERMISSION_DESCRIPTIONS[p]}</div>
                </th>
                {ROLE_KEYS.map((r) => {
                  const has = ROLE_PERMISSIONS[r].includes(p);
                  return (
                    <td key={r} className="border-b border-border px-3 py-2 text-center">
                      {has ? (
                        <span className="inline-flex items-center gap-1 text-thriving">
                          <Check className="size-3.5" aria-hidden />
                          <span className="text-[11px] font-semibold">Yes</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-foreground-faint">
                          <Minus className="size-3.5" aria-hidden />
                          <span className="text-[11px]">No</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
