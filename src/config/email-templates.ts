export interface EmailTemplate {
  key: string;
  name: string;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: readonly EmailTemplate[] = [
  { key: "welcome", name: "Welcome & Handover Confirmation", subject: "You're all set, [Customer First Name]", body: "Hi [Customer First Name],\n\nWelcome! I'm [CSM Name], your Customer Success Manager. Here's a quick confirmation of what's in place for [Company Name]: portal access, license activation and your primary contacts on file.\n\nLet's grab 15 minutes to walk through the fastest path to your first result. [Scheduling Link]" },
  { key: "self-onboard", name: "Self-Onboarding Education", subject: "Getting started — a few quick resources", body: "Hi [Customer First Name],\n\nI wanted to send a few resources to help you get moving on your own timeline: Getting Started Guide, portal login, and a quick-start video.\n\nWhenever you're ready, I'm happy to walk through this live. [Scheduling Link]" },
  { key: "close-loop", name: "Detractor Close-the-Loop", subject: "Thanks for the honest feedback — let's talk", body: "Hi [Customer First Name],\n\nThank you for the feedback — I read it personally and wanted to follow up right away. Would you have 15 minutes this week for a quick call? [Scheduling Link]" },
  { key: "first-value", name: "First Value Check-in", subject: "Have you hit your first milestone yet?", body: "Hi [Customer First Name],\n\nIt's been a few weeks since go-live — checking in on progress toward your first milestone. If anything is in the way, I'd like to help clear it. [Scheduling Link]" },
  { key: "self-serve", name: "Self-Serve Enablement / Quick Start", subject: "Everything you need for your first result", body: "Hi [Customer First Name],\n\nHere are the resources our fastest-moving customers use in their first weeks: Quick Start Guide, feature walkthroughs and our live training schedule." },
  { key: "usage-dip", name: "Usage Dip Re-engagement", subject: "We noticed things have slowed down", body: "Hi [Customer First Name],\n\nLooking at your usage, activity has dropped off recently. A few common reasons and quick fixes — let me know which applies and I'll get you sorted." },
  { key: "office-hours", name: "CS Support Office Hours Invite", subject: "Open invite: live help this week", body: "Hi [Customer First Name],\n\nI'm holding time open this week for a live working session, no agenda required. Join here: [Meeting Link]" },
  { key: "new-version", name: "New Version Available", subject: "New capabilities available on your account", body: "Hi [Customer First Name],\n\nA newer release is available with meaningful improvements for your team. Upgrading is straightforward — here's the guide: [Link]" },
  { key: "version-remind", name: "Version Update Reminder", subject: "Reminder: your upgrade is ready when you are", body: "Hi [Customer First Name],\n\nJust a quick follow-up on the newer release available for your account. Grab time here if you'd like a hand: [Scheduling Link]" },
  { key: "exec-checkin", name: "Executive Check-in / Account Review Invite", subject: "Checking in on your experience", body: "Hi [Stakeholder First Name],\n\nI wanted to check in directly and schedule a brief account review to walk through usage trends, blockers, and a plan to get more value. [Scheduling Link]" },
  { key: "renewal-kickoff", name: "Renewal Kickoff", subject: "Your renewal is coming up — let's plan ahead", body: "Hi [Customer First Name],\n\nYour subscription renews on [Renewal Date]. [Account Manager Name] and I will put together an account summary and reach out to schedule a renewal conversation." },
  { key: "roi-recap", name: "Value Realization / ROI Recap", subject: "What your team has achieved this year", body: "Hi [Customer First Name],\n\nAhead of our renewal conversation, here's a quick recap of what your team has accomplished. Full summary attached — [Account Manager Name] will reach out shortly." },
  { key: "escalation-ack", name: "Escalation Acknowledgment", subject: "We're on it: [Issue Summary]", body: "Hi [Customer First Name],\n\nConfirming we've received this and are treating it as a priority. I'll keep you updated every 24–48 hours until resolved." },
  { key: "escalation-resolved", name: "Escalation Resolution Confirmation", subject: "Resolved: [Issue Summary]", body: "Hi [Customer First Name],\n\nConfirming that this has been resolved as of [Date]. Summary of what happened, what we did, and what we're doing to prevent recurrence below." },
  { key: "growth", name: "Growth Opportunity", subject: "A quick idea for scaling this further", body: "Hi [Customer First Name],\n\nYour team's usage has been consistently strong, and I wanted to flag an opportunity: [specific expansion angle — more seats, a new use case, or an additional workspace].\n\nWorth 15 minutes to explore what that could look like? [Scheduling Link]" },
];

export function getEmailTemplate(key: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find((t) => t.key === key);
}
