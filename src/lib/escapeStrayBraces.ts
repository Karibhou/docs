/**
 * Backslash-escapes `{` and `}` in prose so MDX renders them literally.
 *
 * MDX parses `{…}` as a JavaScript expression while tokenizing, before any
 * remark plugin runs, so a stray Go-template token such as `{{.Mountpoint}}`
 * makes compileMdx throw and drops the whole page to the raw-text fallback.
 * Escaping the braces in the source avoids that.
 *
 * Left untouched: fenced code blocks, inline code spans, JSX/HTML tags (which
 * may carry `prop={…}`; remarkStripMdxJs removes those), and `{/* … *\/}`
 * comments.
 */
export function escapeStrayBraces(input: string): string {
  const protectedParts: string[] = [];
  const put = (block: string) => {
    const key = `\u0000BRACE_PROTECT_${protectedParts.length}\u0000`;
    protectedParts.push(block);
    return key;
  };

  let s = input;
  // `(?![\s\S])` means end-of-input; a bare `$` under the `m` flag would match
  // at the first newline and cut the fence short after its opening line.
  s = s.replace(
    /^( {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n {0,3}\2[`~]*[ \t]*(?=\n|(?![\s\S]))|(?![\s\S]))/gm,
    m => put(m)
  );
  s = s.replace(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/g, m => put(m));
  s = s.replace(/\{\/\*[\s\S]*?\*\/\}/g, m => put(m));
  s = s.replace(/<\/?[A-Za-z][^<>]*>/g, m => put(m));

  s = s.replace(/(?<!\\)([{}])/g, "\\$1");

  return s.replace(
    /\u0000BRACE_PROTECT_(\d+)\u0000/g,
    (_m, i) => protectedParts[Number(i)]
  );
}
