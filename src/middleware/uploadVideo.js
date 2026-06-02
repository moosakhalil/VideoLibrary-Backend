import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO_DIR = path.join(__dirname, '..', '..', 'uploads', 'videos');

if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    cb(null, `vid-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const ALLOWED = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

function fileFilter(req, file, cb) {
  if (ALLOWED.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only video files are allowed (mp4, webm, ogg, mov).'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB per file
});

// Single optional file under field name "video".
export const uploadVideoFile = upload.single('video');

// Accept the main video and an optional sample clip in one request.
export const uploadVideoFiles = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'sampleVideo', maxCount: 1 },
]);
