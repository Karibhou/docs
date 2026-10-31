- The navbar GitHub stats (stars, forks, watchers) now load in production:
  `connect-src` allows `https://img.shields.io` (and the production docs host
  used for `shared.json` on preview deploys), and the header test pins both
  (hivecommons/docs#532).
