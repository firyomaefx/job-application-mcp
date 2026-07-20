// Pure version comparison for the auto-update decision. CommonJS so main.js can
// `require()` it and Node tests can load it via createRequire.
//
// Returns true when `latest` is strictly newer than `current` (semver-ish:
// major.minor.patch, optional leading "v", optional pre-release ignored for
// the comparison). Anything that cannot be parsed compares as "no update" so
// a malformed remote feed never downgrades or loops the app.

function parseVer(v) {
  if (v == null) return null;
  const m = String(v).trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function isUpdateAvailable(current, latest) {
  const a = parseVer(current);
  const b = parseVer(latest);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (b[i] !== a[i]) return b[i] > a[i];
  }
  return false; // equal
}

module.exports = { parseVer, isUpdateAvailable };