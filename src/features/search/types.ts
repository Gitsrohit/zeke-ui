export type SearchCategory = "accounts" | "contacts" | "opportunities" | "audiences" | "agents" | "tasks";

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export type SearchResults = Record<SearchCategory, SearchHit[]>;

export const SEARCH_CATEGORY_LABELS: Record<SearchCategory, string> = {
  accounts: "Accounts",
  contacts: "Contacts",
  opportunities: "Opportunities",
  audiences: "Audiences",
  agents: "Agents",
  tasks: "Tasks",
};
