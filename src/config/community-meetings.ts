export type MeetingException = {
  date: string;
  reason: string;
};

export const COMMUNITY_MEETINGS = {
  title: "Hive Commons Community Meeting",
  timeZone: "America/New_York",
  weekday: "Thursday",
  timeLabel: "10:00 AM Eastern time",
  durationMinutes: 30,
  // First occurrence of the public calendar series (DTSTART) and its
  // RRULE interval (FREQ=WEEKLY;INTERVAL=2;BYDAY=TH). Keep these in sync
  // with the calendar so the page and invites always agree.
  anchorDate: "2026-09-10",
  intervalDays: 14,
  localTime: { hour: 10, minute: 0 },
  calendarName: "Hive Commons",
  calendarId:
    "b43dc28a888d316aa1fe4a47bf3038cd1bca7bbb2b5cdbf5e7ecb9cc10672a95@group.calendar.google.com",
  calendarIcsUrl:
    "https://calendar.google.com/calendar/ical/b43dc28a888d316aa1fe4a47bf3038cd1bca7bbb2b5cdbf5e7ecb9cc10672a95%40group.calendar.google.com/public/basic.ics",
  calendarWebUrl: "https://hivecommons.dev/calendar",
  inviteUrl: "https://hivecommons.dev/meet",
  agendaUrl: "https://hivecommons.dev/agenda",
  googleGroupUrl: "https://hivecommons.dev/join",
  joinUrl: "https://hivecommons.dev/join",
  recordingsUrl: "https://hivecommons.dev/tv",
  meetingUrl:
    "https://teams.microsoft.com/meet/291288876243839?p=k1qddNZCd2ZLjHxXri",
  meetingId: "291 288 876 243 839",
  docsUrl: "https://hivecommons.dev/docs",
  codeUrl: "https://hivecommons.dev/code",
  feedUrl:
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCIA3fKJFv2nLoG6vKK65xLg",
  youtubeChannelUrl: "https://hivecommons.dev/tv",
  youtubeChannelId: "UCIA3fKJFv2nLoG6vKK65xLg",
  recordingTitlePattern: "community meeting|community call|meeting recording",
  exceptions: [] as MeetingException[],
} as const;
