/**
 * Fenced-code-block normalisation shared by the docs sync scripts.
 *
 * The upstream repos are linted loosely (or not at all), but this site runs
 * markdownlint with MD031 (blank lines around fences) and MD040 (fences must
 * declare a language) enabled because both rules also mark constructs that
 * break the MDX compiler used to render synced pages. Rather than fight every
 * upstream author, the sync normalises the fences at import time so the
 * committed copies under docs/content/ always satisfy the two rules.
 */

/** Language applied to a fence opener that does not declare one (MD040). */
export const DEFAULT_FENCE_LANGUAGE = "text";

const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;

/** Where a line sits relative to fenced code blocks. */
export type FenceLineKind = "outside" | "opener" | "inside" | "closer";

/**
 * Line-by-line fenced-code-block tracker: the one fence rule every sync script
 * shares. Feed lines in document order, without their trailing newline. A
 * fence opens on a run of three or more backticks or tildes — except a
 * backtick run whose info string contains a backtick, which CommonMark does
 * not treat as a fence — and closes on a line of the same marker character, at
 * least as long as the opener, with no info string.
 */
export class FenceTracker {
  private openMarker: string | null = null;

  /** Classify `line` and advance the tracker past it. */
  next(line: string): FenceLineKind {
    const m = line.match(FENCE_RE);
    if (this.openMarker !== null) {
      if (
        m &&
        m[2][0] === this.openMarker[0] &&
        m[2].length >= this.openMarker.length &&
        m[3].trim() === ""
      ) {
        this.openMarker = null;
        return "closer";
      }
      return "inside";
    }
    if (m && !(m[2][0] === "`" && m[3].includes("`"))) {
      this.openMarker = m[2];
      return "opener";
    }
    return "outside";
  }
}

/**
 * Split content into consecutive segments that are either inside a fenced code
 * block (opener and closer lines included) or outside one. Concatenating the
 * `text` of every segment reproduces `content` exactly. An unclosed fence runs
 * to the end of the content.
 */
export function splitFencedSegments(
  content: string
): Array<{ text: string; fenced: boolean }> {
  const segments: Array<{ text: string; fenced: boolean }> = [];
  const fences = new FenceTracker();

  for (const line of content.split(/(?<=\n)/)) {
    const fenced = fences.next(line.replace(/\r?\n$/, "")) !== "outside";
    const last = segments[segments.length - 1];
    if (last && last.fenced === fenced) last.text += line;
    else segments.push({ text: line, fenced });
  }
  return segments;
}

/** Apply `fn` to the text outside fenced code blocks; fences are untouched. */
export function mapOutsideFences(
  content: string,
  fn: (text: string) => string
): string {
  return splitFencedSegments(content)
    .map(seg => (seg.fenced ? seg.text : fn(seg.text)))
    .join("");
}

/**
 * Ensure every fenced code block declares a language and is surrounded by
 * blank lines. Fence content is never touched; only opener lines and the
 * lines adjacent to a fence are rewritten.
 */
export function normalizeFences(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  const fences = new FenceTracker();

  for (const line of lines) {
    const kind = fences.next(line);
    if (kind === "inside" || kind === "closer") {
      out.push(line);
      if (kind === "closer") {
        // MD031: a closer needs a blank line after it. We cannot look ahead
        // without buffering, so the check happens when the next line lands.
        out.push("\0AFTER_FENCE");
      }
      continue;
    }

    if (out.length > 0 && out[out.length - 1] === "\0AFTER_FENCE") {
      out.pop();
      if (line.trim() !== "") out.push("");
    }

    if (kind === "opener") {
      const [, indent, marker, info] = line.match(FENCE_RE)!;
      // MD031: blank line before the opener.
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      // MD040: language on the opener.
      const lang =
        info.trim() === "" ? DEFAULT_FENCE_LANGUAGE : info.trimStart();
      out.push(`${indent}${marker}${lang}`);
      continue;
    }

    out.push(line);
  }

  if (out.length > 0 && out[out.length - 1] === "\0AFTER_FENCE") out.pop();
  return out.join("\n");
}
