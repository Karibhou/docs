- The MDX-to-Markdown sync conversion now uses the same fenced-code-block
  rule as the other sync scripts (hivecommons/docs#569): a backtick run whose
  info string contains a backtick is no longer mistaken for a fence opener, so
  it can no longer hide a component's closing tag.
