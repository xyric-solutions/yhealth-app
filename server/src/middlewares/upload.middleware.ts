import multer from 'multer';
import type { Request, RequestHandler, Response } from 'express';
import { MAX_FILE_SIZE, type FileType } from '../services/r2.service.js';

// Extended request type with file
export interface FileRequest extends Request {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

// Memory storage for processing before R2 upload
const storage = multer.memoryStorage();

// Create upload middleware - allows all file types, 20MB max
export const createUploadMiddleware = (
  _fileType: FileType,
  fieldName: string = 'file'
): RequestHandler => {
  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });

  return upload.single(fieldName) as RequestHandler;
};

// Create upload middleware for multiple files
export const createMultiUploadMiddleware = (
  _fileType: FileType,
  fieldName: string = 'files',
  maxCount: number = 10
): RequestHandler => {
  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: maxCount,
    },
  });

  return upload.array(fieldName, maxCount) as RequestHandler;
};

// Create upload middleware for multiple fields
export const createFieldsUploadMiddleware = (
  fields: Array<{ name: string; maxCount: number }>
): RequestHandler => {
  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });

  return upload.fields(fields.map((f) => ({ name: f.name, maxCount: f.maxCount }))) as RequestHandler;
};

// Pre-built middlewares for common use cases
export const uploadImage = createUploadMiddleware('image', 'image');
export const uploadAvatar = createUploadMiddleware('avatar', 'avatar');
export const uploadDocument = createUploadMiddleware('document', 'document');
export const uploadAudio = createUploadMiddleware('audio', 'audio');
export const uploadVideo = createUploadMiddleware('video', 'video');
export const uploadFile = createUploadMiddleware('file', 'file');

// Multiple files upload
export const uploadImages = createMultiUploadMiddleware('image', 'images', 10);
export const uploadFiles = createMultiUploadMiddleware('file', 'files', 10);

// Error handler for multer errors
export const handleUploadError = (
  error: Error,
  _req: Request,
  res: Response,
  next: (err?: Error) => void
): void => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
        res.status(400).json({
          success: false,
          message: `File too large. Maximum size: ${maxSizeMB}MB`,
          code: 'FILE_TOO_LARGE',
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          success: false,
          message: 'Too many files',
          code: 'TOO_MANY_FILES',
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          success: false,
          message: `Unexpected field: ${error.field}`,
          code: 'UNEXPECTED_FIELD',
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'UPLOAD_ERROR',
        });
        return;
    }
  } else {
    next(error);
  }
};
