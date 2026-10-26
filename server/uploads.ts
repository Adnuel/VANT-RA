/**
 * VANTÉRA Product Asset & Image Upload Engine
 * Slogan: Technology, Elevated.
 *
 * Handles file uploads, image validation, sanitization, and persistent storage
 * in /public/uploads/ so that CEO can upload images directly from the dashboard.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Request, Response } from 'express';

const UPLOAD_DIR = path.resolve(process.cwd(), 'public/uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface UploadResult {
  url: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  dimensions?: { width: number; height: number };
}

/**
 * Saves a base64 or raw buffer image asset to the server public storage
 */
export function saveImageBuffer(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): UploadResult {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error('Image file exceeds maximum allowable size (10 MB)');
  }

  const cleanMime = mimeType.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
    throw new Error('Unsupported image format. Allowed: JPEG, PNG, WebP, SVG');
  }

  const ext = path.extname(originalFilename).toLowerCase() || (cleanMime === 'image/png' ? '.png' : cleanMime === 'image/webp' ? '.webp' : '.jpg');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);
  const sanitizedBase = path.basename(originalFilename, ext).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24);
  const finalFilename = `${sanitizedBase}-${hash}${ext}`;
  const targetPath = path.join(UPLOAD_DIR, finalFilename);

  fs.writeFileSync(targetPath, buffer);

  return {
    url: `/uploads/${finalFilename}`,
    filename: finalFilename,
    sizeBytes: buffer.length,
    mimeType: cleanMime,
  };
}

/**
 * Express middleware / route handler for base64 JSON payload uploads
 */
export function handleBase64Upload(req: Request, res: Response) {
  try {
    const { base64Data, filename = 'product-image.jpg', mimeType = 'image/jpeg' } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'Missing base64Data in request payload' });
    }

    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const result = saveImageBuffer(buffer, filename, mimeType);

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Image upload failed' });
  }
}
