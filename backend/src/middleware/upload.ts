import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Use absolute path so read/write resolve the same file (avoids ENOENT when cwd differs, e.g. on Railway)
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const subdirs = ['videos', 'images', 'csv', 'documents', 'misc', 'pdf'];
for (const subdir of subdirs) {
  const dirPath = path.join(uploadDir, subdir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine subdirectory based on file type
    let subDir = 'misc';
    if (file.fieldname === 'video') subDir = 'videos';
    else if (file.fieldname === 'image' || file.fieldname === 'thumbnail') subDir = 'images';
    else if (file.fieldname === 'csv') subDir = 'csv';
    else if (file.fieldname === 'excel' || file.fieldname === 'xlsx') subDir = 'documents';
    else if (file.fieldname === 'document') subDir = 'documents';
    else if (file.fieldname === 'pdf') subDir = 'pdf';
    cb(null, path.join(uploadDir, subDir));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname) || (file.fieldname === 'pdf' ? '.pdf' : '');
    // Use safe generated name for PDFs to avoid ENOENT from spaces/path chars in original filename
    if (file.fieldname === 'pdf') {
      cb(null, `quote-${uniqueSuffix}${ext}`);
    } else {
      const basename = path.basename(file.originalname, path.extname(file.originalname)).replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${basename}-${uniqueSuffix}${ext}`);
    }
  }
});

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Define allowed file types per field
  const allowedTypes: Record<string, string[]> = {
    video: ['video/mp4', 'video/webm', 'video/ogg'],
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    thumbnail: ['image/jpeg', 'image/png', 'image/webp'],
    csv: ['text/csv', 'application/vnd.ms-excel'],
    excel: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    pdf: ['application/pdf']
  };

  const fieldAllowedTypes = allowedTypes[file.fieldname] || [];
  
  if (fieldAllowedTypes.length === 0 || fieldAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed: ${fieldAllowedTypes.join(', ')}`));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800') // Default 50MB
  }
});

// Export configured upload middleware
export const uploadVideo = upload.single('video');
export const uploadImage = upload.single('image');
export const uploadThumbnail = upload.single('thumbnail');
export const uploadCSV = upload.single('csv');
export const uploadExcel = upload.single('excel');
export const uploadDocument = upload.single('document');
export const uploadPDF = upload.single('pdf');
export const uploadMultiple = upload.array('files', 10);

export default upload;
