// ISO-8601 week number (1..53). Everyone sees the same week, changing each Monday.
export function getIsoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO week day: Monday = 1 ... Sunday = 7
  const dayNum = d.getUTCDay() || 7;
  // Shift to the Thursday of the current week.
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Split a category's videos into ordered bundles of 3..4, then pick this week's.
export function pickWeeklyBundle(videos, isoWeek) {
  if (!videos.length) return { bundleIndex: 0, bundleCount: 0, videos: [] };

  const bundles = [];
  // Greedy slices of 4; if a trailing bundle would be size 1 or 2, merge logic
  // keeps groups at 3-4 by simply slicing 4 at a time (last bundle may be 1-4).
  for (let i = 0; i < videos.length; i += 4) {
    bundles.push(videos.slice(i, i + 4));
  }

  const bundleCount = bundles.length;
  const bundleIndex = isoWeek % bundleCount; // loops automatically
  return { bundleIndex, bundleCount, videos: bundles[bundleIndex] };
}
