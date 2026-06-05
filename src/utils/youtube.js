// Pull the 11-char ID out of any YouTube URL, or accept a bare ID.
export function extractYoutubeId(input = '') {
  const s = String(input).trim();
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return s; // fall back to whatever was given
}
