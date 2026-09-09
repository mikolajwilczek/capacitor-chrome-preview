# Persistent Chrome Profile

Research date: 2026-09-09

## Decision

Keep the current disposable per-run profile as the default. Add
`--persist-session` as an explicit opt-in that reuses the project-local,
tool-owned `.tmp/chrome-preview-profile/persistent` user data directory.

Do not accept an arbitrary profile path and never use the normal Chrome user
data directory. This preserves the controller's ownership boundary and avoids
exposing the user's everyday browser profile to remote debugging.

## Evidence

- Chromium documents that the user data directory contains cookies, history,
  bookmarks, and other profile state, and that `--user-data-dir` selects a
  custom location: [User Data Directory](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md).
- Since Chrome 136, remote-debugging switches are ignored for the default Chrome
  data directory. Chrome requires a non-standard `--user-data-dir` and
  recommends it to isolate debugging from real profiles:
  [Changes to remote debugging switches](https://developer.chrome.com/blog/remote-debugging-port).

## Tradeoffs

- Login cookies and site storage can survive restarts, subject to each site's
  own expiry and authentication rules.
- The persistent directory contains sensitive local state. It stays ignored by
  Git, must not be shared, and is removed manually when the user wants a clean
  profile.
- Chromium does not support two running Chrome instances sharing one user data
  directory. The existing spawned-process and exact launch-marker checks must
  continue to reject a run whose browser ownership cannot be proven.
