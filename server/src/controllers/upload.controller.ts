import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { r2Service, type FileType } from "../services/r2.service.js";
import type { AuthenticatedRequest } from "../types/index.js";
import type { FileRequest } from "../middlewares/upload.middleware.js";

// Combined auth + file request type
type AuthFileRequest = AuthenticatedRequest & FileRequest;

// Helper to encode file key for URL-safe transmission
const encodeKey = (key: string): string => Buffer.from(key).toString("base64");

/**
 * Upload a single file
 * POST /api/upload/:type
 */
export const uploadFile = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const { type } = req.params;
    const file = req.file;
    const userId = req.user?.userId;

    if (!file) {
      throw ApiError.badRequest("No file provided");
    }

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    // Validate file type parameter
    const validTypes: FileType[] = [
      "image",
      "avatar",
      "blog",
      "document",
      "audio",
      "video",
      "file",
    ];
    if (!validTypes.includes(type as FileType)) {
      throw ApiError.badRequest(
        `Invalid file type. Allowed: ${validTypes.join(", ")}`
      );
    }

    const result = await r2Service.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        fileType: type as FileType,
        userId,
        isPublic: type === "avatar",
      }
    );

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        key: result.key,
        encodedKey: encodeKey(result.key),
        url: result.url, // Presigned URL (expires) - for temporary access
        publicUrl: result.publicUrl || result.url, // Public URL (permanent if configured) - use this for avatars stored in database
        size: result.size,
        mimeType: result.mimeType,
        originalName: result.originalName,
        // NOTE: For avatar uploads, always use publicUrl when saving to database to avoid expiration
      },
    });
  }
);

/**
 * Upload multiple files
 * POST /api/upload/:type/multiple
 */
export const uploadMultipleFiles = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const { type } = req.params;
    const files = req.files as Express.Multer.File[];
    const userId = req.user?.userId;

    if (!files || files.length === 0) {
      throw ApiError.badRequest("No files provided");
    }

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    // Validate file type parameter
    const validTypes: FileType[] = [
      "image",
      "avatar",
      "blog",
      "document",
      "audio",
      "video",
      "file",
    ];
    if (!validTypes.includes(type as FileType)) {
      throw ApiError.badRequest(
        `Invalid file type. Allowed: ${validTypes.join(", ")}`
      );
    }

    const results = await Promise.all(
      files.map((file) =>
        r2Service.upload(file.buffer, file.originalname, file.mimetype, {
          fileType: type as FileType,
          userId,
          isPublic: type === "avatar",
        })
      )
    );

    res.status(201).json({
      success: true,
      message: `${results.length} files uploaded successfully`,
      data: {
        files: results.map((r) => ({
          key: r.key,
          encodedKey: encodeKey(r.key),
          url: r.url,
          publicUrl: r.publicUrl,
          size: r.size,
          mimeType: r.mimeType,
          originalName: r.originalName,
        })),
      },
    });
  }
);

/**
 * Get presigned upload URL (for direct browser uploads)
 * POST /api/upload/presign
 */
export const getPresignedUrl = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const { fileName, mimeType, fileType, isPublic } = req.body;
    const userId = req.user?.userId;

    if (!fileName || !mimeType || !fileType) {
      throw ApiError.badRequest(
        "fileName, mimeType, and fileType are required"
      );
    }

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    // Validate file type parameter
    const validTypes: FileType[] = [
      "image",
      "avatar",
      "blog",
      "document",
      "audio",
      "video",
      "file",
    ];
    if (!validTypes.includes(fileType as FileType)) {
      throw ApiError.badRequest(
        `Invalid file type. Allowed: ${validTypes.join(", ")}`
      );
    }

    const result = await r2Service.getPresignedUploadUrl(
      fileName,
      mimeType,
      {
        fileType: fileType as FileType,
        userId,
        isPublic: isPublic ?? false,
      },
      3600
    );

    res.json({
      success: true,
      message: "Presigned URL generated",
      data: {
        uploadUrl: result.uploadUrl,
        key: result.key,
        encodedKey: encodeKey(result.key),
        publicUrl: result.publicUrl,
        expiresIn: 3600,
      },
    });
  }
);

/**
 * Get signed URL for file access
 * GET /api/upload/url/:key (key is base64 encoded)
 */
export const getFileUrl = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const { key: encodedKey } = req.params;

    if (!encodedKey) {
      throw ApiError.badRequest("File key is required");
    }

    // Decode base64 key
    const key = Buffer.from(encodedKey, "base64").toString("utf-8");

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    // Check if file exists
    const exists = await r2Service.exists(key);
    if (!exists) {
      throw ApiError.notFound("File not found");
    }

    const url = await r2Service.getSignedUrl(key, 3600);
    const publicUrl = r2Service.getPublicUrl(key);

    res.json({
      success: true,
      data: {
        url,
        publicUrl,
        expiresIn: 3600,
      },
    });
  }
);

/**
 * Get file metadata
 * GET /api/upload/metadata/:key (key is base64 encoded)
 */
export const getFileMetadata = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const { key: encodedKey } = req.params;

    if (!encodedKey) {
      throw ApiError.badRequest("File key is required");
    }

    // Decode base64 key
    const key = Buffer.from(encodedKey, "base64").toString("utf-8");

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    const metadata = await r2Service.getMetadata(key);
    if (!metadata) {
      throw ApiError.notFound("File not found");
    }

    res.json({
      success: true,
      data: metadata,
    });
  }
);

/**
 * Delete file
 * DELETE /api/upload/file/:key (key is base64 encoded)
 */
export const deleteFile = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const { key: encodedKey } = req.params;

    if (!encodedKey) {
      throw ApiError.badRequest("File key is required");
    }

    // Decode base64 key
    const key = Buffer.from(encodedKey, "base64").toString("utf-8");

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    // Check if file exists
    const exists = await r2Service.exists(key);
    if (!exists) {
      throw ApiError.notFound("File not found");
    }

    await r2Service.delete(key);

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  }
);

/**
 * List user files
 * GET /api/upload/list/:folder
 */
export const listFiles = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const { folder } = req.params;
    const userId = req.user?.userId;
    const { limit = "100" } = req.query;

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    // Build prefix with user folder
    const prefix = userId ? `${folder}/${userId}` : folder;

    const files = await r2Service.listFiles(
      prefix,
      parseInt(limit as string, 10)
    );

    res.json({
      success: true,
      data: {
        folder: prefix,
        count: files.length,
        files,
      },
    });
  }
);

/**
 * Upload avatar (convenience endpoint)
 * POST /api/upload/avatar
 */
export const uploadAvatar = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const file = req.file;
    const userId = req.user?.userId;

    if (!file) {
      throw ApiError.badRequest("No file provided");
    }

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    const result = await r2Service.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        fileType: "avatar",
        userId,
        isPublic: true,
      }
    );

    res.status(201).json({
      success: true,
      message: "Avatar uploaded successfully",
      data: {
        key: result.key,
        url: result.url, // Presigned URL (expires) - use publicUrl for permanent access
        publicUrl: result.publicUrl || result.url, // Public URL (permanent) - use this for storing in database
        // IMPORTANT: For avatars, always use publicUrl when saving to database to avoid expiration
      },
    });
  }
);

/**
 * Upload voice assistant avatar
 * POST /api/upload/voice-assistant-avatar
 * Uploads avatar and updates user preferences
 */
export const uploadVoiceAssistantAvatar = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const file = req.file;
    const userId = req.user?.userId;

    if (!file) {
      throw ApiError.badRequest("No file provided");
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw ApiError.badRequest("Invalid file type. Allowed: JPEG, PNG, WebP");
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw ApiError.badRequest("File too large. Maximum size is 5MB");
    }

    if (!r2Service.isR2Configured()) {
      throw ApiError.internal("File storage service not configured");
    }

    // Upload to R2
    const result = await r2Service.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        fileType: "avatar",
        userId,
        isPublic: true,
      }
    );

    // Update user preferences with the avatar URL
    const { query } = await import("../database/pg.js");
    // Convert undefined to null for PostgreSQL query
    const publicUrlValue: string | null = result.publicUrl ?? null;
    await query(
      `UPDATE user_preferences 
       SET voice_assistant_avatar_url = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $2`,
      [publicUrlValue, userId] as (string | number | boolean | null | Date | object)[]
    );

    res.status(201).json({
      success: true,
      message: "Voice assistant avatar uploaded successfully",
      data: {
        key: result.key,
        url: result.url,
        publicUrl: result.publicUrl,
      },
    });
  }
);

/**
 * Health check for storage service
 * GET /api/upload/health
 */
export const healthCheck = asyncHandler(
  async (_req: AuthFileRequest, res: Response) => {
    const health = await r2Service.healthCheck();

    res.json({
      success: true,
      data: health,
    });
  }
);
