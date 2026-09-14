export const INBOX_VERSION = 1 as const;
export const INBOX_STORAGE_KEY = "smartcart.inbox.v1";

export type InboxMessageType = "weekly_report" | "monthly_report";

/** Local report message shape reserved for Epic 8 report generation. */
export interface InboxMessage {
  id: string;
  type: InboxMessageType;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  title: string;
  summary: string;
  spendingRm: number | null;
  savingsRm: number | null;
  readAt: string | null;
}

export interface InboxEnvelope {
  version: typeof INBOX_VERSION;
  messages: InboxMessage[];
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isNullableMoney(value: unknown): value is number | null {
  return value === null
    || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

export function isInboxMessage(value: unknown): value is InboxMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return typeof message.id === "string"
    && message.id.trim().length > 0
    && (message.type === "weekly_report" || message.type === "monthly_report")
    && isIsoDate(message.createdAt)
    && isIsoDate(message.periodStart)
    && isIsoDate(message.periodEnd)
    && typeof message.title === "string"
    && message.title.trim().length > 0
    && typeof message.summary === "string"
    && isNullableMoney(message.spendingRm)
    && isNullableMoney(message.savingsRm)
    && (message.readAt === null || isIsoDate(message.readAt));
}

/** Safely upgrades the known envelope and ignores malformed messages. */
export function migrateInbox(raw: unknown): InboxMessage[] {
  if (!raw || typeof raw !== "object") return [];
  const envelope = raw as Record<string, unknown>;
  if (envelope.version !== INBOX_VERSION || !Array.isArray(envelope.messages)) return [];
  const seen = new Set<string>();
  return envelope.messages.filter(isInboxMessage).filter(message => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

export function serializeInbox(messages: InboxMessage[]): string {
  const envelope: InboxEnvelope = { version: INBOX_VERSION, messages };
  return JSON.stringify(envelope);
}

export function parseInbox(serialized: string | null | undefined): InboxMessage[] {
  if (!serialized) return [];
  try {
    return migrateInbox(JSON.parse(serialized) as unknown);
  } catch {
    return [];
  }
}

export function addInboxMessage(messages: InboxMessage[], message: InboxMessage): InboxMessage[] {
  if (!isInboxMessage(message) || messages.some(existing => existing.id === message.id)) return messages;
  return [message, ...messages];
}

export function setInboxMessageRead(
  messages: InboxMessage[],
  messageId: string,
  isRead: boolean,
  readAt = new Date().toISOString(),
): InboxMessage[] {
  let changed = false;
  const next = messages.map(message => {
    if (message.id !== messageId) return message;
    const nextReadAt = isRead ? readAt : null;
    if (message.readAt === nextReadAt) return message;
    changed = true;
    return { ...message, readAt: nextReadAt };
  });
  return changed ? next : messages;
}

export function markAllInboxMessagesRead(
  messages: InboxMessage[],
  readAt = new Date().toISOString(),
): InboxMessage[] {
  if (messages.every(message => message.readAt !== null)) return messages;
  return messages.map(message => message.readAt === null ? { ...message, readAt } : message);
}

export function unreadInboxCount(messages: InboxMessage[]): number {
  return messages.reduce((count, message) => count + (message.readAt === null ? 1 : 0), 0);
}
