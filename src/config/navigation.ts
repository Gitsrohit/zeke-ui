import { Bot, Gauge, LayoutGrid, Layers, ListChecks, Settings, Sparkles, Target, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  crumb: string;
  title: string;
  icon: LucideIcon;
  badge?: "work" | "risk";
  permission?: Permission;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", crumb: "Overview", title: "Customer Health Dashboard", icon: LayoutGrid },
  { href: "/score-dashboard", label: "Advanced Score Dashboard", crumb: "Score Explainability", title: "Advanced Score Dashboard", icon: Layers },
  { href: "/outcomes", label: "Drive Outcome", crumb: "AI Insights", title: "Drive Outcome", icon: Sparkles, badge: "risk" },
  { href: "/my-work", label: "My Work", crumb: "Work Queue", title: "My Work", icon: ListChecks, badge: "work" },
  { href: "/scorecards", label: "Scorecards", crumb: "Health Model", title: "Health Scorecards", icon: Gauge },
  { href: "/audiences", label: "Audience Creator", crumb: "Segmentation", title: "Audience Creator", icon: Target },
  { href: "/agents", label: "Agents", crumb: "Automation", title: "Agents", icon: Bot },
  { href: "/admin", label: "Admin Panel", crumb: "Configuration", title: "Admin Panel", icon: Settings },
];

const EXTRA_TITLES: Array<{ prefix: string; crumb: string; title: string }> = [
  { prefix: "/accounts/", crumb: "Accounts", title: "Account Detail" },
  { prefix: "/accounts", crumb: "Accounts", title: "All Accounts" },
  { prefix: "/agents/analytics", crumb: "Automation", title: "Agent Analytics" },
  { prefix: "/agents/runs", crumb: "Automation", title: "Agent Run" },
  { prefix: "/agents/new", crumb: "Automation", title: "Agent Builder" },
  { prefix: "/audiences/new", crumb: "Segmentation", title: "Audience Builder" },
  { prefix: "/scorecards/", crumb: "Health Model", title: "Scorecard" },
];

export function resolveNav(pathname: string): { crumb: string; title: string; active?: NavItem } {
  const extra = EXTRA_TITLES.find((e) => pathname.startsWith(e.prefix));
  const active = NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  if (extra) return { crumb: extra.crumb, title: extra.title, active };
  if (active) return { crumb: active.crumb, title: active.title, active };
  return { crumb: "Zeke", title: "Zeke AI" };
}
