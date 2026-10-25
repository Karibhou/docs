"use client";

import { useEffect, useMemo, useState } from "react";
import recordingsData from "../../../data/meeting-recordings.json";
import { COMMUNITY_MEETINGS } from "@/config/community-meetings";
import {
  getUpcomingOddIsoWeekMeetings,
  type UpcomingMeeting,
} from "@/lib/communityMeetingsSchedule";

type Recording = {
  id: string;
  title: string;
  publishedAt: string;
  url: string;
  thumbnail: string;
  description?: string;
  duration?: string;
};

const UPCOMING_COUNT = 4;
const COUNTDOWN_REFRESH_MS = 60_000;
const RESOURCE_LINKS = [
  { label: "Group", href: COMMUNITY_MEETINGS.googleGroupUrl },
  { label: "Docs", href: COMMUNITY_MEETINGS.docsUrl },
  { label: "Code", href: COMMUNITY_MEETINGS.codeUrl },
  { label: "YouTube", href: COMMUNITY_MEETINGS.recordingsUrl },
];

function formatMeetingDate(
  date: Date,
  dateStyle: Intl.DateTimeFormatOptions["dateStyle"] = "full"
) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: dateStyle === "full" ? "long" : "short",
    year: "numeric",
    month: dateStyle === "full" ? "long" : "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: COMMUNITY_MEETINGS.timeZone,
    timeZoneName: "short",
  }).format(date);
}

function formatLocalDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function meetingEnd(date: Date) {
  return new Date(date.getTime() + COMMUNITY_MEETINGS.durationMinutes * 60_000);
}

function formatCountdown(meeting: UpcomingMeeting | undefined, now: Date) {
  if (!meeting) return "Calculating next meeting";

  const end = meetingEnd(meeting.date);
  if (now >= meeting.date && now <= end) return "Happening now";

  const diffMs = meeting.date.getTime() - now.getTime();
  if (diffMs <= 0) return "Starting soon";

  const totalMinutes = Math.ceil(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"} ${hours} h`;
  if (hours > 0) return `in ${hours} h ${minutes} min`;
  return `in ${minutes} min`;
}

function calendarHref(date: Date) {
  const start = date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const end = new Date(
    date.getTime() + COMMUNITY_MEETINGS.durationMinutes * 60_000
  )
    .toISOString()
    .replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: COMMUNITY_MEETINGS.title,
    dates: `${start}/${end}`,
    ctz: COMMUNITY_MEETINGS.timeZone,
    location: COMMUNITY_MEETINGS.meetingUrl,
    details: [
      `Join on Microsoft Teams: ${COMMUNITY_MEETINGS.meetingUrl}`,
      `Meeting ID: ${COMMUNITY_MEETINGS.meetingId}`,
      `Agenda: ${COMMUNITY_MEETINGS.agendaUrl}`,
      `Group: ${COMMUNITY_MEETINGS.googleGroupUrl}`,
    ].join("\n"),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function icsDownloadHref(date: Date) {
  const details = [
    `Join on Microsoft Teams: ${COMMUNITY_MEETINGS.meetingUrl}`,
    `Meeting ID: ${COMMUNITY_MEETINGS.meetingId}`,
    `Agenda and notes: ${COMMUNITY_MEETINGS.agendaUrl}`,
    `Get invites every meeting: ${COMMUNITY_MEETINGS.googleGroupUrl}`,
  ].join("\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hive Commons//Docs Community Meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${COMMUNITY_MEETINGS.title.replace(/\s+/g, "-").toLowerCase()}-${toIcsDate(date)}@docs.hivecommons.dev`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(date)}`,
    `DTEND:${toIcsDate(meetingEnd(date))}`,
    `SUMMARY:${escapeIcsText(COMMUNITY_MEETINGS.title)}`,
    `DESCRIPTION:${escapeIcsText(details)}`,
    `LOCATION:${escapeIcsText(COMMUNITY_MEETINGS.meetingUrl)}`,
    `URL:${COMMUNITY_MEETINGS.meetingUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function RecordingCard({
  recording,
  active,
  onPlay,
}: {
  recording: Recording;
  active: boolean;
  onPlay: () => void;
}) {
  const title = recording.title;
  const published = new Date(recording.publishedAt);

  return (
    <article className="hc-meeting-recording">
      <div className="hc-meeting-videoShell">
        {active ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${recording.id}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            className="hc-meeting-videoButton"
            type="button"
            onClick={onPlay}
            aria-label={`Play ${title}`}
          >
            <img src={recording.thumbnail} alt="" loading="lazy" />
            <span className="hc-meeting-play" aria-hidden="true">
              ▶
            </span>
          </button>
        )}
      </div>
      <div className="hc-meeting-recordingBody">
        <h3>{title}</h3>
        <p>
          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
            published
          )}
        </p>
        {recording.duration ? <p>{recording.duration}</p> : null}
        <a href={recording.url} target="_blank" rel="noreferrer">
          Watch on YouTube
        </a>
      </div>
    </article>
  );
}

export function MeetingsPage() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingMeeting[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    function refresh() {
      const current = new Date();
      setNow(current);
      setUpcoming(
        getUpcomingOddIsoWeekMeetings(
          COMMUNITY_MEETINGS,
          UPCOMING_COUNT,
          current
        )
      );
    }

    refresh();
    const timer = window.setInterval(refresh, COUNTDOWN_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const next = upcoming[0];
  const countdown = now
    ? formatCountdown(next, now)
    : "Calculating next meeting";
  const icsHref = useMemo(
    () => (next ? icsDownloadHref(next.date) : "#"),
    [next]
  );
  const recordings = (recordingsData.recordings as Recording[]).filter(
    recording =>
      new RegExp(COMMUNITY_MEETINGS.recordingTitlePattern, "i").test(
        recording.title
      )
  );

  return (
    <div className="hc-meetings-page">
      <section
        className="hc-meeting-hero hc-meeting-nextHero"
        aria-label="Next community meeting"
      >
        <div className="hc-meeting-nextHeroMain">
          <p className="hc-meeting-kicker">Next meeting</p>
          {next ? (
            <>
              <h2>{formatMeetingDate(next.date)}</h2>
              <p className="hc-meeting-localTime">
                In your local time: {formatLocalDate(next.date)}
              </p>
              <p className="hc-meeting-countdown" aria-live="polite">
                {countdown}
              </p>
              <div className="hc-meeting-actions">
                <a
                  className="hc-meeting-primary hc-meeting-joinNow"
                  href={COMMUNITY_MEETINGS.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Join the meeting
                </a>
                <span className="hc-meeting-id">
                  Microsoft Teams · Meeting ID {COMMUNITY_MEETINGS.meetingId}
                </span>
                <a
                  href={icsHref}
                  download={`hive-commons-community-meeting-${next.localDate}.ics`}
                >
                  Download .ics
                </a>
                <a
                  href={calendarHref(next.date)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Calendar
                </a>
              </div>
            </>
          ) : (
            <p>
              The next date is being calculated from the public calendar
              recurrence.
            </p>
          )}
        </div>
        <aside className="hc-meeting-nextHeroAside">
          <h2>Meet the people building Hive Commons.</h2>
          <p>
            The community call happens on {COMMUNITY_MEETINGS.weekday}s in
            odd-numbered ISO weeks at {COMMUNITY_MEETINGS.timeLabel}. You can
            join the video call directly, or subscribe to the group to receive
            invites for every meeting.
          </p>
          <div className="hc-meeting-actions">
            <a
              className="hc-meeting-secondary"
              href={COMMUNITY_MEETINGS.googleGroupUrl}
              target="_blank"
              rel="noreferrer"
            >
              Get invites every meeting — join the group
            </a>
            <a
              href={COMMUNITY_MEETINGS.agendaUrl}
              target="_blank"
              rel="noreferrer"
            >
              Agenda and notes
            </a>
          </div>
        </aside>
      </section>

      <nav
        className="hc-meeting-resources"
        aria-label="Community meeting resources"
      >
        <span>Resources</span>
        {RESOURCE_LINKS.map(link => (
          <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </nav>

      <section className="hc-meeting-grid" aria-label="Meeting schedule">
        <article className="hc-meeting-details">
          <h2>Agenda and meeting notes</h2>
          <p>
            Add topics before the call, follow along live, and read notes from
            previous meetings in the shared agenda document.
          </p>
          <div className="hc-meeting-actions">
            <a
              href={COMMUNITY_MEETINGS.agendaUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open agenda and notes
            </a>
            <a
              href={COMMUNITY_MEETINGS.calendarWebUrl}
              target="_blank"
              rel="noreferrer"
            >
              Public calendar
            </a>
          </div>
        </article>

        <article className="hc-meeting-upcoming">
          <h2>Upcoming</h2>
          <ol>
            {upcoming.map(meeting => (
              <li key={meeting.localDate}>
                <span>{formatMeetingDate(meeting.date, "medium")}</span>
                <small>{formatLocalDate(meeting.date)}</small>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="hc-meeting-details">
        <h2>How it self-sustains</h2>
        <ul>
          <li>
            Dates are computed in {COMMUNITY_MEETINGS.timeZone} as the meeting
            weekday in every odd-numbered ISO week, so DST stays correct.
          </li>
          <li>
            The source calendar is available as{" "}
            <a href={COMMUNITY_MEETINGS.calendarIcsUrl}>public iCal</a>.
          </li>
          <li>
            Recordings are refreshed from the Hive Commons YouTube channel feed
            and merged into committed JSON by a scheduled workflow.
          </li>
        </ul>
      </section>

      <section
        className="hc-meeting-recordings"
        aria-labelledby="recordings-heading"
      >
        <div className="hc-meeting-sectionHead">
          <div>
            <p className="hc-meeting-kicker">Past recordings</p>
            <h2 id="recordings-heading">Watch without leaving the docs</h2>
          </div>
          <a
            href={COMMUNITY_MEETINGS.recordingsUrl}
            target="_blank"
            rel="noreferrer"
          >
            All recordings
          </a>
        </div>

        {recordings.length > 0 ? (
          <div className="hc-meeting-recordingGrid">
            {recordings.map(recording => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                active={activeVideo === recording.id}
                onPlay={() => setActiveVideo(recording.id)}
              />
            ))}
          </div>
        ) : (
          <div className="hc-meeting-empty">
            Recordings will appear here after each meeting.
          </div>
        )}
      </section>
    </div>
  );
}
