import { describe, expect, it } from "vitest";

import {
  INBOX_STORAGE_KEY,
  INBOX_VERSION,
  addInboxMessage,
  markAllInboxMessagesRead,
  parseInbox,
  serializeInbox,
  setInboxMessageRead,
  unreadInboxCount,
  type InboxMessage,
} from "./inbox";

const weekly: InboxMessage = {
  id: "weekly-1",
  type: "weekly_report",
  createdAt: "2026-09-14T08:00:00.000Z",
  periodStart: "2026-09-07T00:00:00.000Z",
  periodEnd: "2026-09-13T23:59:59.000Z",
  title: "Your weekly SmartCart report",
  summary: "Your spending and estimated savings for last week.",
  spendingRm: 120.5,
  savingsRm: 12,
  readAt: null,
};

const monthly: InboxMessage = {
  ...weekly,
  id: "monthly-1",
  type: "monthly_report",
  createdAt: "2026-09-01T08:00:00.000Z",
  periodStart: "2026-08-01T00:00:00.000Z",
  periodEnd: "2026-08-31T23:59:59.000Z",
  title: "Your monthly SmartCart report",
  spendingRm: null,
  savingsRm: null,
  readAt: "2026-09-02T08:00:00.000Z",
};

describe("local inbox model", () => {
  it("uses the versioned storage key and round-trips report types", () => {
    expect(INBOX_STORAGE_KEY).toBe("smartcart.inbox.v1");
    expect(INBOX_VERSION).toBe(1);
    expect(parseInbox(serializeInbox([weekly, monthly]))).toEqual([weekly, monthly]);
  });

  it("counts unread messages and supports read and unread transitions", () => {
    expect(unreadInboxCount([weekly, monthly])).toBe(1);
    const read = setInboxMessageRead([weekly, monthly], weekly.id, true, "2026-09-14T09:00:00.000Z");
    expect(read[0].readAt).toBe("2026-09-14T09:00:00.000Z");
    expect(unreadInboxCount(read)).toBe(0);
    const unread = setInboxMessageRead(read, weekly.id, false);
    expect(unread[0].readAt).toBeNull();
    expect(unreadInboxCount(unread)).toBe(1);
  });

  it("marks all unread messages at one timestamp and preserves already-read entries", () => {
    const read = markAllInboxMessagesRead([weekly, monthly], "2026-09-14T10:00:00.000Z");
    expect(read.map(message => message.readAt)).toEqual([
      "2026-09-14T10:00:00.000Z",
      monthly.readAt,
    ]);
    expect(markAllInboxMessagesRead(read)).toBe(read);
  });

  it("adds unique messages at the front and ignores duplicate identifiers", () => {
    const added = addInboxMessage([monthly], weekly);
    expect(added.map(message => message.id)).toEqual([weekly.id, monthly.id]);
    expect(addInboxMessage(added, { ...weekly, title: "Duplicate" })).toBe(added);
  });

  it("keeps valid messages while ignoring malformed records and unknown envelopes", () => {
    const serialized = JSON.stringify({
      version: INBOX_VERSION,
      messages: [weekly, { ...monthly, spendingRm: "unknown" }, "bad", weekly],
    });
    expect(parseInbox(serialized)).toEqual([weekly]);
    expect(parseInbox(JSON.stringify({ version: 99, messages: [weekly] }))).toEqual([]);
    expect(parseInbox("{bad json")).toEqual([]);
    expect(parseInbox(null)).toEqual([]);
  });
});
