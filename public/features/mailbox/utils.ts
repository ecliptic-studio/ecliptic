/**
 * Mailbox Feature Utilities
 *
 * Helper functions for mailbox and email data formatting
 */

import type { EmailStatus, TMailboxEmailRecipient } from "./types";

/**
 * Format recipient display name (name only, with email as fallback)
 */
export function formatRecipientName(recipient: TMailboxEmailRecipient | null): string {
  if (!recipient) return "-";
  return recipient.name || recipient.email;
}

/**
 * Format full recipient for tooltip (name <email> or just email)
 */
export function formatRecipientFull(recipient: TMailboxEmailRecipient | null): string {
  if (!recipient) return "-";
  return recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email;
}

/**
 * Format date and time separately
 */
export function formatDateTime(dateString: string | null): { date: string; time: string } {
  if (!dateString) return { date: "-", time: "" };

  const date = new Date(dateString);
  const dateFormatted = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timeFormatted = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return { date: dateFormatted, time: timeFormatted };
}

/**
 * Get badge styles for email status
 */
export function getStatusBadgeStyle(status: EmailStatus): string {
  switch (status) {
    case "PENDING":
      return "bg-orange-500 text-white";
    case "TODO":
      return "bg-yellow-400 text-black";
    case "DONE":
      return "bg-green-500 text-white";
    case "DISCARDED":
      return "bg-red-500 text-white";
  }
}

/**
 * Mock status generator - cycles through statuses for demo
 */
export function mockStatus(index: number): EmailStatus {
  const statuses: EmailStatus[] = ["PENDING", "TODO", "DONE", "DISCARDED"];
  return statuses[index % statuses.length]!;
}

/**
 * Mock tags generator - assigns random tags for demo
 */
export function mockTags(index: number): string[] {
  const allTags = [
    ["sales", "inquiry"],
    ["billing", "urgent"],
    ["spam", "marketing"],
    ["spam"],
    ["support"],
    ["sales", "partnership"],
    ["internal"],
    ["billing", "invoice"],
  ];
  return allTags[index % allTags.length] || [];
}

/**
 * Get provider label for display
 */
export function getProviderLabel(provider: "outlook" | "gmail"): string {
  switch (provider) {
    case "outlook":
      return "Outlook";
    case "gmail":
      return "Gmail (Not supported yet)";
    default:
      return provider;
  }
}
