- Removed 30 orphan translation keys from the de, es, fr, hi, pt, it and ja
  message bundles and added a vitest parity guard that fails when a locale
  carries a key or ICU placeholder set that `messages/en.json` lacks
  (hivecommons/docs#699). Missing translations still fall back to English.
