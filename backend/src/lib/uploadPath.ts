/**
 * Single source of truth for the uploads directory.
 * When running on Railway with a volume attached, use RAILWAY_VOLUME_MOUNT_PATH
 * so uploads persist across deploys. Otherwise use UPLOAD_DIR or default "uploads".
 */
import path from 'path';
import fs from 'fs';

const SUBDIRS = ['videos', 'images', 'csv', 'documents', 'misc', 'pdf', 'literature', 'avatars', 'logos'];

/**
 * Returns the absolute path to the uploads directory.
 * - If RAILWAY_VOLUME_MOUNT_PATH is set (Railway volume), uses {mount}/uploads.
 * - Else if UPLOAD_DIR is set, uses that (resolved from cwd).
 * - Else uses {cwd}/uploads.
 */
export function getUploadDir(): string {
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (mount) {
    return path.join(mount, 'uploads');
  }
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
}

/** Ensures the upload directory and standard subdirs exist. Call at startup. */
export function ensureUploadDirs(): void {
  const base = getUploadDir();
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }
  for (const sub of SUBDIRS) {
    const dir = path.join(base, sub);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
