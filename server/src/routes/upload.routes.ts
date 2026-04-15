import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  createUploadMiddleware,
  createMultiUploadMiddleware,
  uploadAvatar as uploadAvatarMiddleware,
} from '../middlewares/upload.middleware.js';
import {
  uploadFile,
  uploadMultipleFiles,
  getPresignedUrl,
  getFileUrl,
  getFileMetadata,
  deleteFile,
  listFiles,
  uploadAvatar,
  uploadVoiceAssistantAvatar,
  healthCheck,
} from '../controllers/upload.controller.js';
import type { FileType } from '../services/r2.service.js';

const router = Router();

// Health check (public)
router.get('/health', healthCheck);

// All other routes require authentication
router.use(authenticate);

// Get presigned URL for direct browser uploads
router.post('/presign', getPresignedUrl);

// Avatar upload (convenience endpoint)
router.post('/avatar', uploadAvatarMiddleware, uploadAvatar);

// Voice assistant avatar upload (uploads and updates preferences)
// Use 'file' field name to match frontend FormData
router.post('/voice-assistant-avatar', createUploadMiddleware('avatar', 'file'), uploadVoiceAssistantAvatar);

// Get signed URL for file access (key is base64 encoded to handle slashes)
router.get('/url/:key', getFileUrl);

// Get file metadata (key is base64 encoded)
router.get('/metadata/:key', getFileMetadata);

// List files in a folder
router.get('/list/:folder', listFiles);

// Delete file (key is base64 encoded)
router.delete('/file/:key', deleteFile);

// Upload single file by type
router.post('/:type', (req: Request, res: Response, next: NextFunction) => {
  const type = req.params.type as FileType;
  const middleware = createUploadMiddleware(type, 'file');
  middleware(req, res, next);
}, uploadFile);

// Upload multiple files by type
router.post('/:type/multiple', (req: Request, res: Response, next: NextFunction) => {
  const type = req.params.type as FileType;
  const middleware = createMultiUploadMiddleware(type, 'files', 10);
  middleware(req, res, next);
}, uploadMultipleFiles);

export default router;
