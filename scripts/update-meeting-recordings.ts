import fs from "fs";
import path from "path";
import { fetchTextWithTimeout } from "./fetch-with-timeout";

const DATA_PATH = path.join(process.cwd(), "data", "meeting-recordings.json");
const FEED_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCIA3fKJFv2nLoG6vKK65xLg";
const CHANNEL_ID = "UCIA3fKJFv2nLoG6vKK65xLg";
const TITLE_RE = /community meeting|community call|meeting recording/i;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

type Recording = {
  id: string;
  title: string;
  publishedAt: string;
  updatedAt?: string;
  url: string;
  thumbnail: string;
  description?: string;
  duration?: string;
};

type Store = {
  updatedAt: string;
  source: string;
  channelId: string;
  recordings: Recording[];
};

function textBetween(input: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(input);
  return match?.[1]?.trim();
}

function attr(input: string, tag: string, name: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*\\s${name}="([^"]+)"[^>]*>`).exec(
    input
  );
  return match?.[1];
}

function decodeXml(input = ""): string {
  // Decode &amp; LAST: decoding it first would fully decode double-encoded
  // content (&amp;lt; -> &lt; -> <), reintroducing escaped markup.
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Accept only https URLs on an expected host; anything else is dropped so a
// malformed/spoofed feed entry cannot persist an arbitrary URL into the
// committed snapshot (consumed by iframe/img/href sinks in MeetingsPage).
function safeHttpsUrl(
  raw: string | undefined,
  isAllowedHost: (host: string) => boolean
): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && isAllowedHost(url.hostname))
      return url.href;
  } catch {
    // not a URL — fall through to undefined
  }
  return undefined;
}

function parseFeed(xml: string): Recording[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.flatMap(entry => {
    const id = textBetween(entry, "yt:videoId");
    const title = decodeXml(textBetween(entry, "title"));
    // id is interpolated raw into an embed iframe src — enforce the exact
    // YouTube video-id shape and drop anything else.
    if (!id || !VIDEO_ID_RE.test(id) || !title || !TITLE_RE.test(title))
      return [];

    return [
      {
        id,
        title,
        publishedAt: textBetween(entry, "published") ?? "",
        updatedAt: textBetween(entry, "updated"),
        url:
          safeHttpsUrl(
            attr(entry, "link", "href"),
            host =>
              host === "www.youtube.com" ||
              host === "youtube.com" ||
              host === "youtu.be"
          ) ?? `https://www.youtube.com/watch?v=${id}`,
        thumbnail:
          safeHttpsUrl(
            attr(entry, "media:thumbnail", "url")?.replace(
              "https://i1.ytimg.com/",
              "https://i.ytimg.com/"
            ),
            host => host === "i.ytimg.com" || host.endsWith(".ytimg.com")
          ) ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        description: decodeXml(textBetween(entry, "media:description")),
      },
    ];
  });
}

function readExisting(): Store {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8")) as Store;
  } catch {
    return {
      updatedAt: new Date(0).toISOString(),
      source: FEED_URL,
      channelId: CHANNEL_ID,
      recordings: [],
    };
  }
}

async function main() {
  const existing = readExisting();
  let fetched: Recording[] = [];

  try {
    const response = await fetchTextWithTimeout(FEED_URL);
    if (!response.ok)
      throw new Error(`YouTube feed returned ${response.status}`);
    fetched = parseFeed(response.body);
  } catch (error) {
    console.warn(
      `meeting recordings feed unavailable; keeping committed data: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const byId = new Map<string, Recording>();
  for (const recording of existing.recordings)
    byId.set(recording.id, recording);
  for (const recording of fetched) {
    const previous = byId.get(recording.id);
    const merged = { ...previous, ...recording };
    // YouTube bumps <updated> on its own schedule and nothing renders it, so
    // an updatedAt-only difference keeps the committed record.
    if (
      previous &&
      JSON.stringify({ ...merged, updatedAt: undefined }) ===
        JSON.stringify({ ...previous, updatedAt: undefined })
    )
      continue;
    byId.set(recording.id, merged);
  }

  const recordings = [...byId.values()].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
  const existingStable = JSON.stringify(existing.recordings);
  const nextStable = JSON.stringify(recordings);

  if (
    existingStable === nextStable &&
    existing.source === FEED_URL &&
    existing.channelId === CHANNEL_ID
  ) {
    console.log(
      `meeting recordings: ${existing.recordings.length} (unchanged)`
    );
    return;
  }

  const next: Store = {
    updatedAt: new Date().toISOString(),
    source: FEED_URL,
    channelId: CHANNEL_ID,
    recordings,
  };

  fs.writeFileSync(DATA_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`meeting recordings: ${next.recordings.length}`);
}

void main();
