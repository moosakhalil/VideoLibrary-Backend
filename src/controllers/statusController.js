import StatusVideo from '../models/StatusVideo.js';
import { extractYoutubeId } from '../utils/youtube.js';
import { getDerivedProgress } from '../services/progressService.js';

// GET /api/web/me/status -> verified total (from construction) + reward video.
// Status submission/verification now lives in construction, so the website no
// longer collects screenshots — it only displays the count and the reward video
// unlocked for that exact milestone.
export async function listStatus(req, res) {
  const { verifiedStatusCount: verifiedTotal } = await getDerivedProgress(req.customer);

  let video = null;
  if (verifiedTotal > 0) {
    const row = await StatusVideo.findOne({ statusNumber: verifiedTotal });
    const youtubeId = extractYoutubeId(row?.youtubeLink || '');
    if (youtubeId) video = { statusNumber: verifiedTotal, youtubeId };
  }

  res.json({ verifiedTotal, video, submissions: [] });
}
