- The MDX-to-Markdown sync's link, image and brace pass now finds fenced code
  with the shared fence rule (hivecommons/docs#571), so it agrees with the
  block pass: a backtick run with a backtick in its info string, or a fence
  closed by a longer marker run, no longer hides the prose links after it
  from rewriting.
