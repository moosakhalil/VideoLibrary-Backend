// Talks to the Construction backend, which owns referral ("warm lead") and
// WhatsApp-status progress. The website calls this from its own backend only —
// the WEB_API_KEY never reaches the browser.
//
// Construction contract:
//   GET {CONSTRUCTION_API_URI}/api/web/progress?phone=<phone>
//   headers: { 'x-api-key': WEB_API_KEY, 'ngrok-skip-browser-warning': 'true' }
//   -> { found, progress: { warmLeads, verifiedStatuses, badge, vip } }
//
// We depend only on warmLeads, verifiedStatuses and vip.isActive (the badge is
// recomputed locally from the two counts). The return tells callers which of two
// outcomes happened so they can react correctly:
//   { error: true }  -> construction unreachable / not configured; the caller
//                       should fall back to the website's own local numbers.
//   { error: false } -> construction answered; `found` says whether the phone
//                       exists (found:false => genuine zeros, no badge).

const BASE = process.env.CONSTRUCTION_API_URI || process.env.CONSTRUCTION_API_URL || '';
const API_KEY = process.env.WEB_API_KEY || '';
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 30 * 1000; // a dashboard load fires 2-3 lookups for the same phone

// Construction answered, phone not in its system -> show zeros (not an error).
const NOT_FOUND = { error: false, found: false, progress: null };
// Construction unreachable / misconfigured -> signal the caller to use local numbers.
const UPSTREAM_ERROR = { error: true, found: false, progress: null };

// phone -> { at: epochMs, value }
const cache = new Map();

function getCached(phone) {
  const hit = cache.get(phone);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  return null;
}

// Join base + path safely whether or not BASE has a trailing slash.
function buildUrl(phone) {
  const root = BASE.replace(/\/+$/, '');
  const url = new URL(`${root}/api/web/progress`);
  url.searchParams.set('phone', phone);
  return url;
}

export async function fetchConstructionProgress(phone) {
  if (!phone) return NOT_FOUND; // nothing to look up -> genuine zeros, not an outage
  if (!BASE || !API_KEY) {
    console.warn('Construction integration not configured (CONSTRUCTION_API_URI / WEB_API_KEY).');
    return UPSTREAM_ERROR; // unconfigured -> caller falls back to local numbers
  }

  const cached = getCached(phone);
  if (cached) return cached;

  try {
    const resp = await fetch(buildUrl(phone), {
      headers: {
        'x-api-key': API_KEY,
        // Construction may sit behind ngrok, which otherwise returns an HTML
        // browser-warning page instead of JSON. This header skips that.
        'ngrok-skip-browser-warning': 'true',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.error(`Construction progress HTTP ${resp.status} for phone ${phone}`);
      return UPSTREAM_ERROR; // upstream problem -> fall back to local numbers
    }
    const data = await resp.json();
    const value = {
      error: false,
      found: !!data.found,
      progress: data.found ? data.progress || null : null,
    };
    cache.set(phone, { at: Date.now(), value }); // cache only successful answers
    return value;
  } catch (err) {
    console.error('Construction progress fetch failed:', err.message);
    return UPSTREAM_ERROR; // graceful: never break the page on an upstream hiccup
  }
}
