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
    // Allow all image, video, and audio formats using wildcard matching
    const mimeType = file.mimetype.toLowerCase();
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');
    
    if (isImage || isVideo || isAudio) {
      cb(null, true);
    } else {
      // Return error for unsupported file types
      const error = new Error(`Unsupported file type: ${file.mimetype}. Only image, video, and audio files are allowed.`);
      (error as any).code = 'UNSUPPORTED_MEDIA_TYPE';
      cb(error as any);
    }
  }
});

// Initialize GCS client
let storage: Storage | null = null;
let bucket: any = null;

try {
  const gcServiceKey = process.env.GC_SERVICE_KEY;
  const gcsBucketName = process.env.GCS_BUCKET_NAME;
  
  if (!gcServiceKey || !gcsBucketName) {
    throw new Error('GC_SERVICE_KEY and GCS_BUCKET_NAME environment variables must be set');
  }
  
  // Parse the service account key
  const key = JSON.parse(gcServiceKey);
  
  storage = new Storage({
    projectId: key.project_id,
    credentials: key,
  });
  
  bucket = storage.bucket(gcsBucketName);
  console.log('✅ GCS initialized successfully with bucket:', gcsBucketName);
} catch (error) {
  console.error('❌ Failed to initialize GCS:', error);
  console.error('Make sure GC_SERVICE_KEY contains valid JSON and GCS_BUCKET_NAME is set');
}

// Upload endpoint - direct upload to GCS
router.post("/upload", (req, res, next) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      // Handle multer errors
      if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        return res.status(415).json({ error: err.message });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 10MB' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
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
    
    // Create write stream (bucket-level access controls public visibility)
    const stream = blob.createWriteStream({ 
      resumable: false,
      metadata: {
        contentType: req.file.mimetype,
        cacheControl: 'public, max-age=31536000',
      }
    });

    // Handle stream events
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
      stream.end(req.file!.buffer);
    });

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
