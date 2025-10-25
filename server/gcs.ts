import express from "express";
import multer from "multer";
import { Storage } from "@google-cloud/storage";

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, and audio files
    const allowedMimeTypes = [
      'image/png', 
      'image/jpeg', 
      'image/jpg',
      'image/gif',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/mp3'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Initialize GCS client
let storage: Storage | null = null;
let bucket: any = null;

try {
  const key = JSON.parse(process.env.GC_SERVICE_KEY || '{}');
  storage = new Storage({
    projectId: key.project_id,
    credentials: key,
  });
  bucket = storage.bucket(process.env.GCS_BUCKET_NAME || '');
  console.log('✅ GCS initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize GCS:', error);
}

// Upload endpoint - direct upload to GCS
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  if (!storage || !bucket) {
    return res.status(500).json({ error: "GCS not configured" });
  }

  try {
    // Generate unique filename with timestamp
    const filename = `${Date.now()}_${req.file.originalname}`;
    const blob = bucket.file(filename);
    
    // Create write stream
    const stream = blob.createWriteStream({ 
      resumable: false,
      metadata: {
        contentType: req.file.mimetype,
      }
    });

    // Handle stream events
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
      stream.end(req.file!.buffer);
    });

    // Make file publicly accessible
    await blob.makePublic();

    // Return public URL
    const url = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
    res.json({ url });
  } catch (error) {
    console.error('GCS upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Download endpoint - serve files from GCS
router.get("/download/:filename", async (req, res) => {
  if (!storage || !bucket) {
    return res.status(500).json({ error: "GCS not configured" });
  }

  try {
    const { filename } = req.params;
    const file = bucket.file(filename);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: "File not found" });
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();

    // Set headers
    res.set({
      'Content-Type': metadata.contentType || 'application/octet-stream',
      'Content-Length': metadata.size,
      'Cache-Control': 'public, max-age=3600',
    });

    // Stream file to response
    const stream = file.createReadStream();
    
    stream.on('error', (err: Error) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file' });
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error('GCS download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
});

export default router;
