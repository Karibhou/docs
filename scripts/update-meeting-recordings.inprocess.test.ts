import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * update-meeting-recordings.ts has no exported entry point — it resolves
 * DATA_PATH from process.cwd(), calls global fetch, and ends in `void main()`.
 * update-meeting-recordings.test.ts drives it through a spawned tsx child,
 * which exercises the real CLI but leaves v8 coverage blind to the script.
 *
 * These cases import the module in-process (vi.resetModules() per case) after
 * pointing cwd at a throwaway directory and stubbing fetch, so the same
 * behaviour is attributed to the script in the coverage report.
 */

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workRoot = path.join(
  repoRoot,
  ".test-work",
  "meeting-recordings-inprocess"
);
const FEED_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCIA3fKJFv2nLoG6vKK65xLg";
const CHANNEL_ID = "UCIA3fKJFv2nLoG6vKK65xLg";

let caseDir: string;
let originalCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

function writeExisting(store: unknown) {
  fs.writeFileSync(
    path.join(caseDir, "data", "meeting-recordings.json"),
    JSON.stringify(store)
  );
}

function readData() {
  return JSON.parse(
    fs.readFileSync(
      path.join(caseDir, "data", "meeting-recordings.json"),
      "utf8"
    )
  );
}

function stubFeed(xml: string, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status, text: async () => xml }))
  );
}

/** Import the script fresh and wait for its fire-and-forget main() to settle. */
async function runInProcess() {
  vi.resetModules();
  await import("./update-meeting-recordings");
  await vi.waitFor(() => {
    expect(
      logSpy.mock.calls.length + warnSpy.mock.calls.length
    ).toBeGreaterThan(0);
  });
}

beforeEach(() => {
  fs.mkdirSync(workRoot, { recursive: true });
  caseDir = fs.mkdtempSync(path.join(workRoot, "case-"));
  fs.mkdirSync(path.join(caseDir, "data"));
  originalCwd = process.cwd();
  process.chdir(caseDir);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fs.rmSync(caseDir, { recursive: true, force: true });
});

describe("update-meeting-recordings (in-process)", () => {
  it("merges feed entries over committed data and normalises source/channel", async () => {
    writeExisting({
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: "old-source",
      channelId: "old-channel",
      recordings: [
        {
          id: "oldvid00001",
          title: "Community Meeting #1",
          publishedAt: "2026-01-01T00:00:00Z",
          url: "https://example.test/old",
          thumbnail: "https://i.ytimg.com/vi/oldvid00001/hqdefault.jpg",
          duration: "PT30M",
        },
      ],
    });
    stubFeed(`<feed>
      <entry>
        <yt:videoId>newvid00001</yt:videoId>
        <title>Hive Commons Community Call &amp; demo</title>
        <published>2026-02-01T00:00:00Z</published>
        <updated>2026-02-02T00:00:00Z</updated>
        <link href="https://youtu.be/newvid00001" />
        <media:thumbnail url="https://i1.ytimg.com/vi/newvid00001/hqdefault.jpg" />
        <media:description>News &amp; notes</media:description>
      </entry>
      <entry><yt:videoId>skip</yt:videoId><title>Unrelated demo</title></entry>
    </feed>`);

    await runInProcess();

    expect(fetch).toHaveBeenCalledWith(
      FEED_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(logSpy).toHaveBeenCalledWith("meeting recordings: 2");
    const data = readData();
    expect(data.source).toBe(FEED_URL);
    expect(data.channelId).toBe(CHANNEL_ID);
    expect(data.recordings.map((r: { id: string }) => r.id)).toEqual([
      "newvid00001",
      "oldvid00001",
    ]);
    expect(data.recordings[0]).toMatchObject({
      title: "Hive Commons Community Call & demo",
      url: "https://youtu.be/newvid00001",
      thumbnail: "https://i.ytimg.com/vi/newvid00001/hqdefault.jpg",
      description: "News & notes",
      updatedAt: "2026-02-02T00:00:00Z",
    });
    expect(data.recordings[1].duration).toBe("PT30M");
    expect(Date.parse(data.updatedAt)).toBeGreaterThan(
      Date.parse("2026-01-01T00:00:00.000Z")
    );
  });

  it("keeps committed data untouched when the fetch throws", async () => {
    const existing = {
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: FEED_URL,
      channelId: CHANNEL_ID,
      recordings: [
        {
          id: "keepvid0001",
          title: "Community meeting fallback",
          publishedAt: "2026-01-01T00:00:00Z",
          url: "https://example.test/keep",
          thumbnail: "https://i.ytimg.com/vi/keepvid0001/hqdefault.jpg",
        },
      ],
    };
    writeExisting(existing);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await runInProcess();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "meeting recordings feed unavailable; keeping committed data: network down"
      )
    );
    expect(logSpy).toHaveBeenCalledWith("meeting recordings: 1 (unchanged)");
    expect(readData()).toEqual(existing);
  });

  it("treats a non-2xx feed response as unavailable and reports the status", async () => {
    writeExisting({
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: FEED_URL,
      channelId: CHANNEL_ID,
      recordings: [],
    });
    stubFeed("", false, 503);

    await runInProcess();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("YouTube feed returned 503")
    );
    expect(logSpy).toHaveBeenCalledWith("meeting recordings: 0 (unchanged)");
  });

  it("stringifies non-Error rejections in the unavailable warning", async () => {
    writeExisting({
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: FEED_URL,
      channelId: CHANNEL_ID,
      recordings: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw "plain string failure";
      })
    );

    await runInProcess();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("plain string failure")
    );
  });

  it("starts from an empty store when the committed file is missing or unparsable", async () => {
    fs.writeFileSync(
      path.join(caseDir, "data", "meeting-recordings.json"),
      "{not json"
    );
    stubFeed(`<feed>
      <entry>
        <yt:videoId>freshvid001</yt:videoId>
        <title>Meeting recording: kickoff</title>
        <published>2026-03-01T00:00:00Z</published>
      </entry>
      <entry>
        <yt:videoId>nodatevid01</yt:videoId>
        <title>Meeting recording: undated</title>
      </entry>
    </feed>`);

    await runInProcess();

    expect(logSpy).toHaveBeenCalledWith("meeting recordings: 2");
    const data = readData();
    expect(data.recordings).toContainEqual({
      id: "freshvid001",
      title: "Meeting recording: kickoff",
      publishedAt: "2026-03-01T00:00:00Z",
      url: "https://www.youtube.com/watch?v=freshvid001",
      thumbnail: "https://i.ytimg.com/vi/freshvid001/hqdefault.jpg",
      description: "",
    });
    expect(data.recordings).toContainEqual(
      expect.objectContaining({ id: "nodatevid01", publishedAt: "" })
    );
  });

  it("drops malformed video ids and falls back to canonical urls for unsafe hosts/schemes", async () => {
    writeExisting({
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: FEED_URL,
      channelId: CHANNEL_ID,
      recordings: [],
    });
    stubFeed(`<feed>
      <entry>
        <yt:videoId>../evilpath</yt:videoId>
        <title>Community meeting bad id</title>
        <published>2026-02-01T00:00:00Z</published>
      </entry>
      <entry>
        <yt:videoId>goodvid0001</yt:videoId>
        <title>Community meeting bad urls</title>
        <published>2026-02-01T00:00:00Z</published>
        <link href="javascript:alert(1)" />
        <media:thumbnail url="https://evil.example/vi/goodvid0001/hqdefault.jpg" />
      </entry>
      <entry>
        <yt:videoId>goodvid0002</yt:videoId>
        <title>Community meeting http link</title>
        <published>2026-02-03T00:00:00Z</published>
        <link href="http://www.youtube.com/watch?v=goodvid0002" />
        <media:thumbnail url="not a url at all" />
      </entry>
      <entry>
        <yt:videoId>goodvid0003</yt:videoId>
        <title>Community meeting ytimg subdomain</title>
        <published>2026-02-02T00:00:00Z</published>
        <link href="https://youtube.com/watch?v=goodvid0003" />
        <media:thumbnail url="https://i9.ytimg.com/vi/goodvid0003/hqdefault.jpg" />
      </entry>
    </feed>`);

    await runInProcess();

    const data = readData();
    expect(data.recordings.map((r: { id: string }) => r.id)).toEqual([
      "goodvid0002",
      "goodvid0003",
      "goodvid0001",
    ]);
    expect(data.recordings[2]).toMatchObject({
      url: "https://www.youtube.com/watch?v=goodvid0001",
      thumbnail: "https://i.ytimg.com/vi/goodvid0001/hqdefault.jpg",
    });
    expect(data.recordings[0]).toMatchObject({
      url: "https://www.youtube.com/watch?v=goodvid0002",
      thumbnail: "https://i.ytimg.com/vi/goodvid0002/hqdefault.jpg",
    });
    expect(data.recordings[1]).toMatchObject({
      url: "https://youtube.com/watch?v=goodvid0003",
      thumbnail: "https://i9.ytimg.com/vi/goodvid0003/hqdefault.jpg",
    });
  });

  it("decodes entities once so double-encoded markup stays escaped", async () => {
    writeExisting({
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: FEED_URL,
      channelId: CHANNEL_ID,
      recordings: [],
    });
    stubFeed(`<feed>
      <entry>
        <yt:videoId>encvideo001</yt:videoId>
        <title>Community meeting &amp;lt;demo&amp;gt; &quot;q&quot; &#39;a&#39;</title>
        <published>2026-02-01T00:00:00Z</published>
        <media:description>Notes &amp;amp; more</media:description>
      </entry>
    </feed>`);

    await runInProcess();

    expect(readData().recordings[0]).toMatchObject({
      title: `Community meeting &lt;demo&gt; "q" 'a'`,
      description: "Notes &amp; more",
    });
  });

  it("rewrites the store when only source/channel metadata drifted", async () => {
    const recordings = [
      {
        id: "samevid0001",
        title: "Community meeting same",
        publishedAt: "2026-01-01T00:00:00Z",
        url: "https://www.youtube.com/watch?v=samevid0001",
        thumbnail: "https://i.ytimg.com/vi/samevid0001/hqdefault.jpg",
      },
    ];
    writeExisting({
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: "legacy-source",
      channelId: CHANNEL_ID,
      recordings,
    });
    stubFeed("<feed></feed>");

    await runInProcess();

    expect(logSpy).toHaveBeenCalledWith("meeting recordings: 1");
    const data = readData();
    expect(data.source).toBe(FEED_URL);
    expect(data.recordings).toEqual(recordings);
  });

  it("does not rewrite the store when only a recording's feed <updated> moved", async () => {
    const store = {
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: FEED_URL,
      channelId: CHANNEL_ID,
      recordings: [
        {
          id: "bumpvid0001",
          title: "Community meeting bump",
          publishedAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T11:59:21Z",
          url: "https://www.youtube.com/watch?v=bumpvid0001",
          thumbnail: "https://i.ytimg.com/vi/bumpvid0001/hqdefault.jpg",
          description: "Notes",
        },
      ],
    };
    const feed = (title: string, updated: string) => `<feed>
      <entry>
        <yt:videoId>bumpvid0001</yt:videoId>
        <title>${title}</title>
        <published>2026-01-01T00:00:00Z</published>
        <updated>${updated}</updated>
        <media:description>Notes</media:description>
      </entry>
    </feed>`;
    writeExisting(store);
    stubFeed(feed("Community meeting bump", "2026-01-02T12:33:33Z"));

    await runInProcess();

    expect(logSpy).toHaveBeenCalledWith("meeting recordings: 1 (unchanged)");
    expect(readData()).toEqual(store);

    logSpy.mockClear();
    stubFeed(feed("Community meeting renamed", "2026-01-02T12:33:33Z"));

    await runInProcess();

    expect(logSpy).toHaveBeenCalledWith("meeting recordings: 1");
    expect(readData().recordings[0]).toMatchObject({
      title: "Community meeting renamed",
      updatedAt: "2026-01-02T12:33:33Z",
    });
    expect(Date.parse(readData().updatedAt)).toBeGreaterThan(
      Date.parse(store.updatedAt)
    );
  });
});
