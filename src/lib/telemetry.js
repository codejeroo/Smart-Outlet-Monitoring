// Single source of truth for "is this reading live?".
// Both the summary card and the per-node cards must agree on this rule, so it
// lives in one place instead of being re-derived per component.

// The firmware heartbeats roughly every 5s; three missed heartbeats means the
// number on screen is history, not measurement.
export const LIVE_WINDOW_MS = 15000;

// The API sends UTC. If a value ever arrives without a zone marker, treat it as
// UTC rather than letting the browser read it as local time (which silently
// shifts every age by the timezone offset).
export const parseUtc = (value) => {
  if (!value) return null;
  const normalized = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
};

export const formatAge = (ageMs) => {
  const seconds = Math.max(0, Math.round(ageMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
};

// Never assume a number arrived: a single null used to throw and take the whole
// card down with it.
export const num = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : '—');

export const plugLiveness = (plug, now = Date.now()) => {
  const isOn = plug.status === 'on';
  const lastSeenMs = parseUtc(plug.lastSeen);
  const ageMs = lastSeenMs === null ? null : now - lastSeenMs;

  return {
    isOn,
    lastSeenMs,
    ageMs,
    hasNoTelemetry: isOn && ageMs === null,
    isStale: isOn && ageMs !== null && ageMs >= LIVE_WINDOW_MS,
    isLive: isOn && ageMs !== null && ageMs < LIVE_WINDOW_MS,
  };
};
