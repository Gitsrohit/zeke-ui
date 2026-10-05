/** Single source of truth for client-facing API routes. */
export const API = {
  search: (q: string) => `/api/v1/search?q=${encodeURIComponent(q)}`,
  accounts: (params: URLSearchParams) => `/api/v1/accounts?${params.toString()}`,
  accountsExport: (params: URLSearchParams) => `/api/v1/accounts/export?${params.toString()}`,
  scoreDashboardExport: (params: URLSearchParams) => `/api/v1/score-dashboard/export?${params.toString()}`,
  notifications: "/api/v1/notifications",
  audiencePreview: "/api/v1/audiences/preview",
  aiAudience: "/api/v1/ai/audience",
  aiAgent: "/api/v1/ai/agent",
  aiAssistant: "/api/v1/ai/assistant",
  launchPreview: "/api/v1/agents/launch-preview",
  userActivity: (membershipId: string, days: number) => `/api/v1/users/${membershipId}/activity?days=${days}`,
} as const;
