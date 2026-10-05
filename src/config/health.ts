/**
 * Health model configuration — the single source of truth for health sources,
 * sub-metrics, default scorecard weights and default band thresholds.
 * Organisation-specific overrides live in the database (scorecard versions).
 */

export const LIFECYCLE_STAGES = ["Onboarding", "Adoption", "Growth", "Renewal"] as const;
export type LifecycleStageName = (typeof LIFECYCLE_STAGES)[number];

export const SEGMENTS = ["Enterprise", "Mid-Market", "SMB"] as const;
export type SegmentName = (typeof SEGMENTS)[number];

export const HEALTH_SOURCE_KEYS = [
  "telemetry",
  "survey",
  "meetings",
  "tickets",
  "renewal",
  "crm",
  "hygiene",
] as const;
export type HealthSourceKey = (typeof HEALTH_SOURCE_KEYS)[number];

export interface HealthSourceDefinition {
  key: HealthSourceKey;
  name: string;
  shortName: string;
  description: string;
  /** Integration provider that feeds this source. */
  integration: string;
}

export const HEALTH_SOURCES: readonly HealthSourceDefinition[] = [
  { key: "telemetry", name: "Telemetry & Usage", shortName: "Usage", description: "Product logins, feature use, extraction volume", integration: "product_telemetry" },
  { key: "survey", name: "Survey & NPS", shortName: "Survey", description: "Onboarding survey, NPS, in-app pulse surveys", integration: "delighted" },
  { key: "meetings", name: "Meeting Notes & Summaries", shortName: "Meetings", description: "QBR, call and meeting summaries", integration: "gong" },
  { key: "tickets", name: "Support Tickets", shortName: "Tickets", description: "Volume, severity and resolution time", integration: "zendesk" },
  { key: "renewal", name: "Renewal Information", shortName: "Renewal", description: "Contract terms, renewal proximity, price change", integration: "chargebee" },
  { key: "crm", name: "CRM Data", shortName: "CRM", description: "Opportunity stage, exec sponsor, expansion signals", integration: "salesforce" },
  { key: "hygiene", name: "Contact Hygiene", shortName: "Hygiene", description: "Key contacts documented, roles current, champions active", integration: "salesforce" },
];

export function getHealthSource(key: HealthSourceKey): HealthSourceDefinition {
  const source = HEALTH_SOURCES.find((s) => s.key === key);
  if (!source) throw new Error(`Unknown health source: ${key}`);
  return source;
}

export type SourceWeights = Record<HealthSourceKey, number>;

/** Default weighting model per lifecycle stage (each sums to 100). */
export const DEFAULT_WEIGHTS: Record<LifecycleStageName, SourceWeights> = {
  Onboarding: { telemetry: 25, meetings: 25, crm: 15, hygiene: 15, survey: 10, tickets: 5, renewal: 5 },
  Adoption: { telemetry: 30, survey: 15, meetings: 15, tickets: 15, crm: 10, hygiene: 10, renewal: 5 },
  Growth: { telemetry: 25, crm: 20, meetings: 15, survey: 15, tickets: 10, renewal: 10, hygiene: 5 },
  Renewal: { renewal: 30, crm: 20, telemetry: 20, tickets: 10, survey: 10, meetings: 5, hygiene: 5 },
};

export const LIFECYCLE_WEIGHTING_NOTES: Record<LifecycleStageName, string> = {
  Onboarding: "Weighted toward telemetry and meeting notes — the fastest signals of whether a new account is engaging.",
  Adoption: "Weighted toward usage depth and survey sentiment — are they using the product the way healthy accounts do.",
  Growth: "Balances usage with CRM/expansion signals to catch accounts ready to grow or starting to coast.",
  Renewal: "Weighted toward renewal and CRM data — commercial signal matters most this close to the decision.",
};

export const HEALTH_BAND_KEYS = ["thriving", "stable", "atRisk", "critical"] as const;
export type HealthBandKey = (typeof HEALTH_BAND_KEYS)[number];

/** Minimum score (inclusive) for each band above Critical. Critical is the floor (0). */
export interface BandThresholds {
  thriving: number;
  stable: number;
  atRisk: number;
}

export const DEFAULT_BAND_THRESHOLDS: BandThresholds = { thriving: 80, stable: 60, atRisk: 40 };

export interface HealthBandDefinition {
  key: HealthBandKey;
  label: string;
  /** Tailwind token suffix used for colour classes (text-thriving, bg-thriving-tint …). */
  token: "thriving" | "stable" | "at-risk" | "critical";
  description: string;
}

export const HEALTH_BANDS: Record<HealthBandKey, HealthBandDefinition> = {
  thriving: { key: "thriving", label: "Thriving", token: "thriving", description: "Healthy, engaged and getting value." },
  stable: { key: "stable", label: "Stable", token: "stable", description: "Healthy overall, with some signals to watch." },
  atRisk: { key: "atRisk", label: "At Risk", token: "at-risk", description: "Multiple weak signals — intervention recommended." },
  critical: { key: "critical", label: "Critical", token: "critical", description: "Severe risk of churn — act now." },
};

/** Ordered best → worst. */
export const HEALTH_BAND_ORDER: readonly HealthBandKey[] = ["thriving", "stable", "atRisk", "critical"];

/**
 * Sub-metric catalogue per source. A sub-measure scoring 0 sits at `worst`
 * and 100 at `best` (works for lower-is-better measures too). `segmentScaled`
 * measures scale their raw range by account segment.
 */
export interface SubMetricDefinition {
  key: string;
  name: string;
  worst: number;
  best: number;
  unit?: string;
  decimals: number;
  /** Weight within its source (sums to 100 per source). */
  weight: number;
  segmentScaled?: boolean;
  money?: boolean;
  hint?: string;
}

export const SEGMENT_SCALE: Record<SegmentName, number> = { Enterprise: 1, "Mid-Market": 0.32, SMB: 0.09 };

export const SUB_METRICS: Record<HealthSourceKey, readonly SubMetricDefinition[]> = {
  telemetry: [
    { key: "logins", name: "Monthly logins", worst: 60, best: 2600, segmentScaled: true, decimals: 0, weight: 15 },
    { key: "mau", name: "Monthly active users (MAU)", worst: 8, best: 420, segmentScaled: true, decimals: 0, weight: 15 },
    { key: "mauPct", name: "MAU / licensed seats", worst: 12, best: 95, unit: "%", decimals: 0, weight: 20 },
    { key: "golden", name: "Golden feature adoption", worst: 5, best: 92, unit: "%", decimals: 0, weight: 25, hint: "Case Builder · Auto-Redaction · Scheduled Exports" },
    { key: "breadth", name: "Feature breadth", worst: 3, best: 22, unit: " of 24", decimals: 0, weight: 10 },
    { key: "lastLogin", name: "Days since last admin login", worst: 45, best: 0, unit: "d", decimals: 0, weight: 10 },
    { key: "session", name: "Avg. session length", worst: 3, best: 32, unit: " min", decimals: 0, weight: 5 },
  ],
  survey: [
    { key: "nps", name: "NPS", worst: -60, best: 80, decimals: 0, weight: 30 },
    { key: "csat", name: "CSAT", worst: 55, best: 98, unit: "%", decimals: 0, weight: 25 },
    { key: "onb", name: "Onboarding survey", worst: 2.2, best: 4.9, unit: " / 5", decimals: 1, weight: 15 },
    { key: "pulse", name: "In-app pulse response rate", worst: 4, best: 65, unit: "%", decimals: 0, weight: 15 },
    { key: "promoters", name: "Promoter share", worst: 8, best: 75, unit: "%", decimals: 0, weight: 15 },
  ],
  meetings: [
    { key: "cadence", name: "Meetings per month", worst: 0.2, best: 5, decimals: 1, weight: 20 },
    { key: "exec", name: "Exec attendance", worst: 0, best: 90, unit: "%", decimals: 0, weight: 20 },
    { key: "sentiment", name: "AI meeting sentiment", worst: 15, best: 95, unit: " / 100", decimals: 0, weight: 25 },
    { key: "lastMtg", name: "Days since last meeting", worst: 75, best: 2, unit: "d", decimals: 0, weight: 20 },
    { key: "actions", name: "Action items closed", worst: 15, best: 96, unit: "%", decimals: 0, weight: 15 },
  ],
  tickets: [
    { key: "open", name: "Open tickets", worst: 9, best: 0, decimals: 0, weight: 20 },
    { key: "p1", name: "P1 / P2 tickets (90d)", worst: 7, best: 0, decimals: 0, weight: 25 },
    { key: "ttr", name: "Avg. resolution time", worst: 96, best: 4, unit: " hrs", decimals: 0, weight: 20 },
    { key: "tcsat", name: "Ticket CSAT", worst: 55, best: 98, unit: "%", decimals: 0, weight: 15 },
    { key: "esc", name: "Escalations (90d)", worst: 5, best: 0, decimals: 0, weight: 20 },
  ],
  renewal: [
    { key: "util", name: "License utilization", worst: 30, best: 100, unit: "%", decimals: 0, weight: 30 },
    { key: "intent", name: "Renewal intent signal", worst: 15, best: 95, unit: "%", decimals: 0, weight: 25 },
    { key: "payment", name: "Avg. days invoices paid late", worst: 45, best: 0, unit: "d", decimals: 0, weight: 15 },
    { key: "products", name: "Products attached", worst: 1, best: 4, decimals: 0, weight: 15 },
    { key: "discount", name: "Discount dependency", worst: 35, best: 0, unit: "%", decimals: 0, weight: 15 },
  ],
  crm: [
    { key: "stage", name: "Opportunity stage progress", worst: 5, best: 100, unit: "%", decimals: 0, weight: 20 },
    { key: "sponsor", name: "Exec sponsor touches / qtr", worst: 0, best: 8, decimals: 0, weight: 25 },
    { key: "signals", name: "Open expansion signals", worst: 0, best: 5, decimals: 0, weight: 20 },
    { key: "pipeline", name: "Open pipeline", worst: 0, best: 140000, segmentScaled: true, money: true, decimals: 0, weight: 15 },
    { key: "competitor", name: "Competitor mentions (90d)", worst: 6, best: 0, decimals: 0, weight: 20 },
  ],
  hygiene: [
    { key: "roles", name: "Key roles documented", worst: 10, best: 100, unit: "%", decimals: 0, weight: 30 },
    { key: "champion", name: "Days since champion engaged", worst: 90, best: 2, unit: "d", decimals: 0, weight: 25 },
    { key: "engaged", name: "Contacts engaged (30d)", worst: 5, best: 90, unit: "%", decimals: 0, weight: 20 },
    { key: "fresh", name: "Days since roles verified", worst: 365, best: 10, unit: "d", decimals: 0, weight: 15 },
    { key: "bounce", name: "Bounced / invalid emails", worst: 25, best: 0, unit: "%", decimals: 0, weight: 10 },
  ],
};

/** Number of monthly periods retained for score explainability. */
export const HEALTH_HISTORY_MONTHS = 12;
