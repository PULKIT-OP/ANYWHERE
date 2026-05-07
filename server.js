require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { Readable } = require("stream");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 3000;

// ── Cloudinary Config ───────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── MongoDB Connection ──────────────────────────────────────────────────────
mongoose
  .connect(
    process.env.MONGO_URI ||
      process.env.MONGO_URL ||
      "mongodb://localhost:27017/fileshare",
  )
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// ── File Schema ─────────────────────────────────────────────────────────────
const fileSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  cloudinaryId: { type: String, required: true }, // public_id on Cloudinary
  downloadUrl: { type: String, required: true }, // secure_url from Cloudinary
  uploadedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }, // Auto-delete timestamp (null = never)
});

const File = mongoose.model("File", fileSchema);

// ── Multer — memory storage (no local disk writes) ──────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function generateCode(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I confusion
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function uniqueCode() {
  let code, exists;
  do {
    code = generateCode();
    exists = await File.findOne({ code });
  } while (exists);
  return code;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Detect which Cloudinary resource_type to use based on MIME
function getResourceType(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/"))
    return "video";
  return "raw"; // pdf, docx, pptx, zip, etc.
}

// Upload a Buffer to Cloudinary via a stream (works with memoryStorage)
function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    Readable.from(buffer).pipe(stream);
  });
}

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /api/upload  →  upload buffer to Cloudinary, save metadata, return code
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided." });

    const { originalname, mimetype, size, buffer } = req.file;
    const { expirationMinutes, customCode } = req.body; // Get expiration and custom code from frontend
    const resourceType = getResourceType(mimetype);

    // Validate custom code if provided
    let code;
    if (customCode) {
      // Validate format: 1-8 alphanumeric characters
      if (!/^[A-Z0-9]{1,8}$/i.test(customCode)) {
        return res
          .status(400)
          .json({ error: "Code must be 1-8 alphanumeric characters." });
      }
      // Check if code already exists
      const existingCode = await File.findOne({
        code: customCode.toUpperCase(),
      });
      if (existingCode) {
        return res.status(409).json({
          error: "This code is already taken. Please choose another.",
        });
      }
      code = customCode.toUpperCase();
    } else {
      // Generate random code if no custom code provided
      code = await uniqueCode();
    }

    // Push buffer straight to Cloudinary — no temp file on disk
    const result = await uploadToCloudinary(buffer, {
      resource_type: resourceType,
      folder: "fileshare",
      use_filename: true,
      unique_filename: true,
      // 'attachment' flag makes raw files download instead of open in browser
      flags: resourceType === "raw" ? "attachment" : undefined,
    });

    // Calculate expiration time if provided (max 3 days = 4320 minutes)
    let expiresAt = null;
    if (expirationMinutes && expirationMinutes > 0) {
      const MAX_EXPIRATION_MINUTES = 4320; // 3 days
      const validExpirationMinutes = Math.min(
        expirationMinutes,
        MAX_EXPIRATION_MINUTES,
      );
      expiresAt = new Date(Date.now() + validExpirationMinutes * 60 * 1000);
    }

    const fileDoc = await File.create({
      code,
      originalName: originalname,
      mimeType: mimetype,
      size,
      cloudinaryId: result.public_id,
      downloadUrl: result.secure_url,
      expiresAt,
    });

    res.json({
      success: true,
      code: fileDoc.code,
      name: fileDoc.originalName,
      size: formatBytes(fileDoc.size),
      uploadedAt: fileDoc.uploadedAt,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed. Please try again." });
  }
});

// ── Helper: Delete file from both Cloudinary and MongoDB ────────────────────
async function deleteFileFromStorage(fileDoc) {
  try {
    await cloudinary.uploader.destroy(fileDoc.cloudinaryId, {
      resource_type: getResourceType(fileDoc.mimeType),
    });
  } catch (cloudinaryErr) {
    console.warn(
      `Warning: Could not delete from Cloudinary (${fileDoc.code}):`,
      cloudinaryErr.message,
    );
  }
  await File.deleteOne({ code: fileDoc.code });
}

// GET /api/file/:code  →  return file metadata only (no download)
app.get("/api/file/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const fileDoc = await File.findOne({ code });
    if (!fileDoc) return res.status(404).json({ error: "File not found." });

    // Check if file has expired → delete immediately and return not found
    if (fileDoc.expiresAt && new Date() > fileDoc.expiresAt) {
      await deleteFileFromStorage(fileDoc);
      return res.status(404).json({ error: "File not found." });
    }

    res.json({
      success: true,
      code: fileDoc.code,
      name: fileDoc.originalName,
      size: formatBytes(fileDoc.size),
      mimeType: fileDoc.mimeType,
      uploadedAt: fileDoc.uploadedAt,
      expiresAt: fileDoc.expiresAt ? fileDoc.expiresAt.toISOString() : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong." });
  }
});

// GET /api/download/:code  →  redirect to a signed Cloudinary URL
// Cloudinary serves the file directly — zero bandwidth cost on your server
app.get("/api/download/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const fileDoc = await File.findOne({ code });
    if (!fileDoc) return res.status(404).json({ error: "File not found." });

    // Check if file has expired → delete immediately and return not found
    if (fileDoc.expiresAt && new Date() > fileDoc.expiresAt) {
      await deleteFileFromStorage(fileDoc);
      return res.status(404).json({ error: "File not found." });
    }

    // Build a signed URL that forces a browser download with the original filename
    const signedUrl = cloudinary.url(fileDoc.cloudinaryId, {
      resource_type: getResourceType(fileDoc.mimeType),
      type: "upload",
      flags: "attachment",
      download_url: true,
      sign_url: true,
      secure: true,
    });

    // Add filename to content-disposition header
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileDoc.originalName)}"`,
    );
    res.redirect(signedUrl);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed." });
  }
});

// GET /api/preview/:code  →  open file in browser (inline) instead of download
app.get("/api/preview/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const fileDoc = await File.findOne({ code });
    if (!fileDoc) return res.status(404).json({ error: "File not found." });

    // Check if file has expired → delete immediately and return not found
    if (fileDoc.expiresAt && new Date() > fileDoc.expiresAt) {
      await deleteFileFromStorage(fileDoc);
      return res.status(404).json({ error: "File not found." });
    }

    // Build a signed URL that opens file inline in browser
    const signedUrl = cloudinary.url(fileDoc.cloudinaryId, {
      resource_type: getResourceType(fileDoc.mimeType),
      type: "upload",
      sign_url: true,
      secure: true,
    });

    res.redirect(signedUrl);
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "Preview failed." });
  }
});

// DELETE /api/file/:code  →  delete file from Cloudinary and MongoDB
app.delete("/api/file/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const fileDoc = await File.findOne({ code });
    if (!fileDoc) return res.status(404).json({ error: "File not found." });

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(fileDoc.cloudinaryId, {
        resource_type: getResourceType(fileDoc.mimeType),
      });
    } catch (cloudinaryErr) {
      console.warn("Cloudinary deletion warning:", cloudinaryErr.message);
      // Continue to delete from MongoDB even if Cloudinary delete fails
    }

    // Delete from MongoDB
    await File.deleteOne({ code });

    res.json({
      success: true,
      message: "File deleted successfully.",
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Delete failed." });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 FileShare running → http://localhost:${PORT}`);
});
