import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getTimeZoneParts,
  getUpcomingMeetings,
  isoWeekInfo,
  type MeetingScheduleConfig,
} from "@/lib/communityMeetingsSchedule";

// Mirrors the public calendar series:
// DTSTART;TZID=America/New_York:20260910T100000
// RRULE:FREQ=WEEKLY;WKST=SU;INTERVAL=2;BYDAY=TH
const config: MeetingScheduleConfig = {
  timeZone: "America/New_York",
  anchorDate: "2026-09-10",
  intervalDays: 14,
  localTime: { hour: 10, minute: 0 },
  durationMinutes: 30,
  exceptions: [],
};

describe("community meeting 14-day recurrence", () => {
  it("treats 2026-09-24 as a meeting day", () => {
    const [next] = getUpcomingMeetings(
      config,
      1,
      new Date("2026-09-24T11:59:00Z")
    );
    expect(next.localDate).toBe("2026-09-24");
  });

  it("keeps a strict 14-day cadence across the 2026 ISO week 53 boundary", () => {
    expect(isoWeekInfo("2026-12-31")).toMatchObject({
      isoYear: 2026,
      week: 53,
    });

    const meetings = getUpcomingMeetings(
      config,
      4,
      new Date("2026-12-30T15:00:00Z")
    );
    expect(meetings.map(meeting => meeting.localDate)).toEqual([
      "2026-12-31",
      "2027-01-14",
      "2027-01-28",
      "2027-02-11",
    ]);
  });

  it("can cancel a generated date with an exception", () => {
    const meetings = getUpcomingMeetings(
      {
        ...config,
        exceptions: [{ date: "2026-12-31", reason: "holiday break" }],
      },
      2,
      new Date("2026-12-30T15:00:00Z")
    );
    expect(meetings.map(meeting => meeting.localDate)).toEqual([
      "2027-01-14",
      "2027-01-28",
    ]);
  });

  it("keeps the active meeting as next until the meeting window ends", () => {
    const [during] = getUpcomingMeetings(
      config,
      1,
      new Date("2026-09-24T14:15:00Z")
    );
    const [after] = getUpcomingMeetings(
      config,
      1,
      new Date("2026-09-24T14:31:00Z")
    );

    expect(during.localDate).toBe("2026-09-24");
    expect(after.localDate).toBe("2026-10-08");
  });

  it("never returns a date before the anchor", () => {
    const [first] = getUpcomingMeetings(
      config,
      1,
      new Date("2026-01-01T00:00:00Z")
    );
    expect(first.localDate).toBe("2026-09-10");
  });

  it("follows DST: 10:00 ET is 14:00Z in summer and 15:00Z in winter", () => {
    const [summer] = getUpcomingMeetings(
      config,
      1,
      new Date("2026-09-10T00:00:00Z")
    );
    const [winter] = getUpcomingMeetings(
      config,
      1,
      new Date("2027-01-10T00:00:00Z")
    );
    expect(summer.date.toISOString()).toBe("2026-09-10T14:00:00.000Z");
    expect(winter.date.toISOString()).toBe("2027-01-14T15:00:00.000Z");
  });

  it("counts a Sunday as ISO weekday 7 in the week that started on Monday", () => {
    // 2027-01-03 is a Sunday. ISO weeks start on Monday, so it closes the
    // week that began on Monday 2026-12-28 and belongs to ISO year 2026,
    // week 53 — not to 2027-W01. Date#getUTCDay() returns 0 for Sunday;
    // without the `|| 7` fallback the Thursday-shift would land in the next
    // week and misplace every Sunday at a year boundary.
    expect(isoWeekInfo("2027-01-03")).toEqual({
      isoYear: 2026,
      week: 53,
      isoWeekday: 7,
    });
    expect(isoWeekInfo("2027-01-04")).toEqual({
      isoYear: 2027,
      week: 1,
      isoWeekday: 1,
    });
  });
});

describe("getTimeZoneParts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalises the hour12:false midnight hour of 24 to 0", () => {
    // Some ICU builds format midnight as "24" under `hour12: false` (the h24
    // cycle); current Node returns "00". Stub formatToParts to replay the h24
    // shape so the normalisation stays pinned on either runtime.
    vi.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValue([
      { type: "month", value: "09" },
      { type: "literal", value: "/" },
      { type: "day", value: "10" },
      { type: "literal", value: "/" },
      { type: "year", value: "2026" },
      { type: "literal", value: ", " },
      { type: "hour", value: "24" },
      { type: "literal", value: ":" },
      { type: "minute", value: "00" },
      { type: "literal", value: ":" },
      { type: "second", value: "00" },
    ]);

    expect(
      getTimeZoneParts(new Date("2026-09-10T04:00:00Z"), "America/New_York")
    ).toEqual({
      year: 2026,
      month: 9,
      day: 10,
      hour: 0,
      minute: 0,
      second: 0,
    });
  });

  it("passes a real midnight through unchanged as hour 0", () => {
    expect(
      getTimeZoneParts(new Date("2026-09-10T04:00:00Z"), "America/New_York")
    ).toMatchObject({ year: 2026, month: 9, day: 10, hour: 0, minute: 0 });
  });
});
