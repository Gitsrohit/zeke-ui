import type { RoleKey } from "@/lib/permissions";

export const SEED_PASSWORD = "zeke-demo-2026";

export const COMPANY_NAMES = [
  "Meridian Health Systems", "Arclight Legal Group", "Northwind Insurance", "Cobalt Bank & Trust",
  "Vertex Manufacturing", "Solace Retail Co.", "Harbor Point Logistics", "Quillfire Media",
  "Granite Peak Financial", "Elmswood University", "Tidewater Government Services", "Cascade Biotech",
  "Ironclad Security Solutions", "Bluepeak Telecom", "Larkspur Hospitality Group", "Wavelength Analytics",
  "Cedarline Retailers", "Fernbridge Pharmaceuticals", "Stonegate Municipal Services", "Rivermark Credit Union",
  "Alder & Vance Law", "Pinnacle Freight Co.", "Sundial Energy", "Marlowe Insurance Group",
  "Coastline Defense Systems", "Thistledown Nonprofit Alliance", "Ashgrove Manufacturing", "Beacon Ridge Health",
  "Copperline Utilities", "Driftwood Hospitality", "Emberton School District", "Fairhaven Bank",
  "Glasswing Technologies", "Hollowcrest Retailers", "Ironwood Legal Services", "Juniper Point Logistics",
];

export const INDUSTRY_BY_KEYWORD: Array<[RegExp, string]> = [
  [/Health|Biotech|Pharma/, "Healthcare"],
  [/Legal|Law/, "Legal"],
  [/Insurance/, "Insurance"],
  [/Bank|Financial|Credit/, "Financial Services"],
  [/Manufacturing/, "Manufacturing"],
  [/Retail/, "Retail"],
  [/Logistics|Freight/, "Logistics"],
  [/Media|Telecom|Technologies|Analytics/, "Technology"],
  [/University|School/, "Education"],
  [/Government|Municipal|Defense/, "Public Sector"],
  [/Hospitality/, "Hospitality"],
  [/Energy|Utilities/, "Energy & Utilities"],
  [/Security/, "Security"],
  [/Nonprofit/, "Nonprofit"],
];

export interface SeedUser {
  key: string;
  name: string;
  email: string;
  role: RoleKey;
  title: string;
  status: "active" | "invited" | "deactivated";
  segments: string[];
  /** Owns accounts in the book (CSM rotation). */
  ownsAccounts: boolean;
}

/** Order of account owners matches the prototype's OWNERS rotation. */
export const SEED_USERS: SeedUser[] = [
  { key: "maya", name: "Maya Chen", email: "maya.chen@zeke.dev", role: "admin", title: "CS Manager", status: "active", segments: [], ownsAccounts: true },
  { key: "diego", name: "Diego Ruiz", email: "diego.ruiz@zeke.dev", role: "csm", title: "Digital CSM", status: "active", segments: ["SMB", "Mid-Market"], ownsAccounts: true },
  { key: "priya", name: "Priya Nair", email: "priya.nair@zeke.dev", role: "cs_manager", title: "Enterprise CS Lead", status: "active", segments: [], ownsAccounts: true },
  { key: "sam", name: "Sam O'Connor", email: "sam.oconnor@zeke.dev", role: "csm", title: "CSM", status: "active", segments: [], ownsAccounts: true },
  { key: "jordan", name: "Jordan Blake", email: "jordan.blake@zeke.dev", role: "csm", title: "CSM", status: "active", segments: [], ownsAccounts: true },
  { key: "alex", name: "Alex Rivera", email: "alex.rivera@zeke.dev", role: "owner", title: "VP Customer Success", status: "active", segments: [], ownsAccounts: false },
  { key: "riley", name: "Riley Park", email: "riley.park@zeke.dev", role: "viewer", title: "Finance Analyst", status: "active", segments: [], ownsAccounts: false },
  { key: "casey", name: "Casey Morgan", email: "casey.morgan@zeke.dev", role: "csm", title: "Associate CSM", status: "invited", segments: ["SMB"], ownsAccounts: false },
];

export const OWNER_ROTATION = ["maya", "diego", "priya", "sam", "jordan"];

export const ARR_RANGE: Record<string, [number, number]> = {
  Enterprise: [150000, 420000],
  "Mid-Market": [42000, 120000],
  SMB: [8000, 32000],
};

export const CONTACT_FIRST = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Drew", "Sasha", "Quinn", "Reese", "Emerson"];
export const CONTACT_LAST = ["Whitfield", "Nakamura", "Okafor", "Bergström", "Delgado", "Patel", "Kowalski", "Tremblay", "Haddad", "Lindgren"];
export const CONTACT_ROLES = ["VP, Operations", "Director of Security", "IT Administrator", "Compliance Lead", "Procurement Manager", "Head of Investigations", "Systems Analyst", "General Counsel"];
export const CONTACT_STATUS = ["active", "active", "active", "new", "quiet"] as const;

export const NOTE_SNIPPETS = [
  "Champion confirmed budget is intact for next cycle — no red flags on renewal.",
  "Team mentioned they're evaluating a competitor tool for a specific use case — worth a follow-up.",
  "New admin onboarded this week; scheduling a refresher session.",
  "Exec sponsor asked for a one-pager on the latest release — sent over.",
  "Flagged a recurring complaint about report export times — routed to Support.",
  "Great QBR — team is expanding usage into a second department.",
];

export const MEETING_SUBJECTS = ["Quarterly business review", "Monthly check-in", "Roadmap preview", "Admin training session", "Executive sync", "Renewal planning call"];
export const TICKET_SUBJECTS = ["Report export timing out", "SSO configuration question", "Bulk import failing on CSV", "Permission sync delay", "API rate limit increase request", "Dashboard filter not saving"];
export const EMAIL_SUBJECTS = ["Follow-up: action items from our call", "Release notes for this month", "Training resources", "Invoice question", "Introduction to your new support lead"];

export const SEED_INTEGRATIONS = [
  { key: "salesforce", name: "Salesforce CRM", code: "SF", category: "CRM", description: "Opportunity stage, ARR, exec sponsor", connected: true },
  { key: "product_telemetry", name: "Product Telemetry", code: "PT", category: "Product", description: "Serial activations, extraction tokens, feature use", connected: true },
  { key: "zendesk", name: "Zendesk Support", code: "ZD", category: "Support", description: "Ticket volume, severity, resolution time", connected: true },
  { key: "delighted", name: "Delighted Survey", code: "DS", category: "Survey", description: "Onboarding survey and NPS responses", connected: true },
  { key: "gong", name: "Gong Meeting Intel", code: "GG", category: "Meetings", description: "Call and meeting summaries, sentiment", connected: false },
  { key: "outlook", name: "Outlook 365", code: "O365", category: "Email", description: "Email sends and meeting scheduling", connected: true },
  { key: "chargebee", name: "Chargebee Billing", code: "CB", category: "Billing", description: "Renewal dates, contract value, invoices", connected: false },
  { key: "snowflake", name: "Snowflake Warehouse", code: "SN", category: "Warehouse", description: "Blended usage and CRM data mart", connected: false },
];

export const USER_ACTIVITY_TYPES = ["login", "dashboard", "scorecard", "audience", "launch", "approve", "task", "note", "review"] as const;
