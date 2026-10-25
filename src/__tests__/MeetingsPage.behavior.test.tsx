// @vitest-environment jsdom
//
// Covers src/components/community/MeetingsPage.tsx (previously ~7%):
//  - next-meeting hero renders the schedule computed by
//    getUpcomingOddIsoWeekMeetings for the current time
//  - countdown branches: "in N min", "in N h M min", "in N day(s) N h",
//    "Happening now", and the minute-tick interval refresh
//  - Google Calendar link encodes the meeting window and time zone
//  - .ics download href is a valid VCALENDAR with escaped description,
//    30-minute DTSTART/DTEND window, and stable UID/filename
//  - recordings from committed JSON render and clicking play swaps the
//    thumbnail button for a youtube-nocookie iframe
//  - recording-title filter and empty state (mocked recordings data)
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { MeetingsPage } from "@/components/community/MeetingsPage";
import { COMMUNITY_MEETINGS } from "@/config/community-meetings";
import { getUpcomingOddIsoWeekMeetings } from "@/lib/communityMeetingsSchedule";
import recordingsData from "../../data/meeting-recordings.json";

// A fixed anchor time; the actual next meeting is derived from the same
// schedule library the component uses, so the test never hardcodes dates.
const ANCHOR = new Date("2026-10-06T12:00:00Z");

function nextMeetingAfter(now: Date) {
  const [next] = getUpcomingOddIsoWeekMeetings(COMMUNITY_MEETINGS, 1, now);
  return next;
}

function renderAt(now: Date) {
  vi.setSystemTime(now);
  return render(<MeetingsPage />);
}

function countdownText() {
  const el = document.querySelector(".hc-meeting-countdown");
  expect(el).not.toBeNull();
  return el!.textContent;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MeetingsPage next-meeting hero", () => {
  it("renders the meeting compute for the current time with join link and ID", () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(ANCHOR);

    const join = screen.getByRole("link", { name: "Join the meeting" });
    expect(join.getAttribute("href")).toBe(COMMUNITY_MEETINGS.meetingUrl);
    expect(
      screen.getByText(
        `Microsoft Teams · Meeting ID ${COMMUNITY_MEETINGS.meetingId}`
      )
    ).toBeTruthy();

    // Hero heading shows the meeting date formatted in the meeting time zone.
    const heading = document.querySelector(".hc-meeting-nextHeroMain h2")!;
    const expected = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: COMMUNITY_MEETINGS.timeZone,
      timeZoneName: "short",
    }).format(next.date);
    expect(heading.textContent).toBe(expected);
  });

  it("lists UPCOMING_COUNT (4) upcoming meetings matching the schedule library", () => {
    const expected = getUpcomingOddIsoWeekMeetings(
      COMMUNITY_MEETINGS,
      4,
      ANCHOR
    );
    renderAt(ANCHOR);
    const items = document.querySelectorAll(".hc-meeting-upcoming ol li");
    expect(items.length).toBe(4);
    const shortFmt = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: COMMUNITY_MEETINGS.timeZone,
      timeZoneName: "short",
    });
    expected.forEach((meeting, i) => {
      expect(items[i].querySelector("span")!.textContent).toBe(
        shortFmt.format(meeting.date)
      );
    });
  });
});

describe("MeetingsPage countdown branches", () => {
  it("shows minutes only when under an hour away", () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(new Date(next.date.getTime() - 5 * 60_000));
    expect(countdownText()).toBe("in 5 min");
  });

  it("shows hours and minutes when under a day away", () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(new Date(next.date.getTime() - (3 * 60 + 20) * 60_000));
    expect(countdownText()).toBe("in 3 h 20 min");
  });

  it("shows singular day form", () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(new Date(next.date.getTime() - (24 + 2) * 60 * 60_000));
    expect(countdownText()).toBe("in 1 day 2 h");
  });

  it("shows plural days form", () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(new Date(next.date.getTime() - (48 + 5) * 60 * 60_000));
    expect(countdownText()).toBe("in 2 days 5 h");
  });

  it('shows "Happening now" during the meeting window', () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(new Date(next.date.getTime() + 10 * 60_000));
    expect(countdownText()).toBe("Happening now");
  });

  it("ticks the countdown down when the refresh interval fires", () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(new Date(next.date.getTime() - 5 * 60_000));
    expect(countdownText()).toBe("in 5 min");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(countdownText()).toBe("in 4 min");
  });
});

describe("MeetingsPage calendar links", () => {
  it("builds a Google Calendar link spanning the 30-minute meeting window", () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(ANCHOR);

    const link = screen.getByRole("link", { name: "Google Calendar" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe(
      "https://calendar.google.com/calendar/render"
    );
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe(COMMUNITY_MEETINGS.title);
    expect(url.searchParams.get("ctz")).toBe(COMMUNITY_MEETINGS.timeZone);
    expect(url.searchParams.get("location")).toBe(
      COMMUNITY_MEETINGS.meetingUrl
    );
    expect(url.searchParams.get("details")).toContain(
      COMMUNITY_MEETINGS.meetingId
    );

    const compact = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const start = compact(next.date);
    const end = compact(
      new Date(
        next.date.getTime() + COMMUNITY_MEETINGS.durationMinutes * 60_000
      )
    );
    expect(url.searchParams.get("dates")).toBe(`${start}/${end}`);
  });

  it("builds a downloadable ICS with escaped text and a per-date filename", () => {
    const next = nextMeetingAfter(ANCHOR);
    renderAt(ANCHOR);

    const link = screen.getByRole("link", { name: "Download .ics" });
    expect(link.getAttribute("download")).toBe(
      `hive-commons-community-meeting-${next.localDate}.ics`
    );

    const href = link.getAttribute("href")!;
    expect(href.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);
    const ics = decodeURIComponent(
      href.slice("data:text/calendar;charset=utf-8,".length)
    );
    const lines = ics.split("\r\n");

    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");

    const compact = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    expect(lines).toContain(`DTSTART:${compact(next.date)}`);
    expect(lines).toContain(
      `DTEND:${compact(new Date(next.date.getTime() + COMMUNITY_MEETINGS.durationMinutes * 60_000))}`
    );
    expect(lines).toContain(`SUMMARY:${COMMUNITY_MEETINGS.title}`);

    // UID is derived from the title and start date, so repeat downloads of the
    // same meeting dedupe in calendar clients.
    const uid = lines.find(l => l.startsWith("UID:"))!;
    expect(uid).toBe(
      `UID:${COMMUNITY_MEETINGS.title.replace(/\s+/g, "-").toLowerCase()}-${compact(next.date)}@docs.hivecommons.dev`
    );

    // Newlines in the description must be escaped per RFC 5545, never raw.
    const description = lines.find(l => l.startsWith("DESCRIPTION:"))!;
    expect(description).toContain("\\n");
    expect(description).toContain(
      `Meeting ID: ${COMMUNITY_MEETINGS.meetingId}`
    );
  });
});

describe("MeetingsPage recordings (committed data)", () => {
  it("renders each matching committed recording and swaps to an embed on play", () => {
    const matching = (
      recordingsData.recordings as Array<{
        id: string;
        title: string;
        url: string;
      }>
    ).filter(r =>
      new RegExp(COMMUNITY_MEETINGS.recordingTitlePattern, "i").test(r.title)
    );
    expect(matching.length).toBeGreaterThan(0);

    renderAt(ANCHOR);
    const cards = document.querySelectorAll(".hc-meeting-recording");
    expect(cards.length).toBe(matching.length);
    expect(document.querySelector("iframe")).toBeNull();

    const first = matching[0];
    const watchLink = screen.getAllByRole("link", {
      name: "Watch on YouTube",
    })[0];
    expect(watchLink.getAttribute("href")).toBe(first.url);
    expect(watchLink.getAttribute("href")).not.toBe(
      COMMUNITY_MEETINGS.recordingsUrl
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Play ${first.title}` })
    );

    const iframe = document.querySelector("iframe")!;
    expect(iframe.getAttribute("src")).toBe(
      `https://www.youtube-nocookie.com/embed/${first.id}?autoplay=1`
    );
    expect(iframe.getAttribute("allowfullscreen")).not.toBeNull();
    // Only the played card becomes active.
    expect(document.querySelectorAll("iframe").length).toBe(1);
  });
});

describe("MeetingsPage recordings (mocked data)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../../data/meeting-recordings.json");
  });

  async function renderWithRecordings(recordings: unknown[]) {
    vi.resetModules();
    vi.doMock("../../data/meeting-recordings.json", () => ({
      default: { recordings },
    }));
    const { MeetingsPage: MockedPage } =
      await import("@/components/community/MeetingsPage");
    vi.setSystemTime(ANCHOR);
    return render(<MockedPage />);
  }

  it("filters out recordings whose titles do not match the pattern and shows duration", async () => {
    await renderWithRecordings([
      {
        id: "abc123",
        title: "Hive Commons Community Call 2026-09-10",
        publishedAt: "2026-09-10T15:00:00+00:00",
        url: "https://www.youtube.com/watch?v=abc123",
        thumbnail: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
        duration: "31:12",
      },
      {
        id: "zzz999",
        title: "Unrelated conference talk",
        publishedAt: "2026-09-11T15:00:00+00:00",
        url: "https://www.youtube.com/watch?v=zzz999",
        thumbnail: "https://i.ytimg.com/vi/zzz999/hqdefault.jpg",
      },
    ]);

    const cards = document.querySelectorAll(".hc-meeting-recording");
    expect(cards.length).toBe(1);
    expect(
      screen.getByText("Hive Commons Community Call 2026-09-10")
    ).toBeTruthy();
    expect(screen.queryByText("Unrelated conference talk")).toBeNull();
    expect(screen.getByText("31:12")).toBeTruthy();
  });

  it("shows the empty state when no recordings match", async () => {
    await renderWithRecordings([
      {
        id: "zzz999",
        title: "Unrelated conference talk",
        publishedAt: "2026-09-11T15:00:00+00:00",
        url: "https://www.youtube.com/watch?v=zzz999",
        thumbnail: "https://i.ytimg.com/vi/zzz999/hqdefault.jpg",
      },
    ]);

    expect(
      screen.getByText("Recordings will appear here after each meeting.")
    ).toBeTruthy();
    expect(document.querySelector(".hc-meeting-recordingGrid")).toBeNull();
  });
});
