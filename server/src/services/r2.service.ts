import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';
import path from 'path';

// Global max file size: 20MB
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

// File type configurations - all types allowed, 20MB max
export const FILE_TYPES = {
  image: {
    folder: 'images',
  },
  avatar: {
    folder: 'avatars',
  },
  blog: {
    folder: 'blog',
  },
  document: {
    folder: 'documents',
  },
  audio: {
    folder: 'audio',
  },
  video: {
    folder: 'videos',
  },
  file: {
    folder: 'files',
  },
} as const;

export type FileType = keyof typeof FILE_TYPES;

interface UploadOptions {
  fileType: FileType;
  userId?: string;
  customPath?: string;
  isPublic?: boolean;
}

interface UploadResult {
  key: string;
  url: string;
  publicUrl?: string;
  size: number;
  mimeType: string;
  originalName: string;
}

interface FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

class R2Service {
  private static instance: R2Service;
  private client: S3Client | null = null;
  private readonly isConfigured: boolean;
  private readonly bucketName: string;
  private readonly publicUrl: string | undefined;

  private constructor() {
    this.isConfigured = !!(env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey);
    this.bucketName = env.r2.bucketName;
    this.publicUrl = env.r2.publicUrl;

    if (this.isConfigured) {
      this.createClient();
    } else {
      logger.warn('R2 service not configured - missing credentials');
    }
  }

  public static getInstance(): R2Service {
    if (!R2Service.instance) {
      R2Service.instance = new R2Service();
    }
    return R2Service.instance;
  }

  private createClient(): void {
    try {
      this.client = new S3Client({
        region: 'auto',
        endpoint: env.r2.endpoint,
        credentials: {
          accessKeyId: env.r2.accessKeyId!,
          secretAccessKey: env.r2.secretAccessKey!,
        },
        maxAttempts: 3, // Retry up to 3 times
      });
      logger.info('R2 client created', { endpoint: env.r2.endpoint });
    } catch (error) {
      logger.error('Failed to create R2 client', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate unique file key
   */
  private generateFileKey(
    originalName: string,
    options: UploadOptions
  ): string {
    const ext = path.extname(originalName).toLowerCase();
    const hash = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const config = FILE_TYPES[options.fileType];

    let basePath = options.customPath || config.folder;
    if (options.userId) {
      basePath = `${basePath}/${options.userId}`;
    }

    return `${basePath}/${timestamp}-${hash}${ext}`;
  }

  /**
   * Validate file before upload (all types allowed, 20MB max)
   */
  public validateFile(
    _mimeType: string,
    size: number,
    _fileType: FileType
  ): { valid: boolean; error?: string } {
    if (size > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
      return {
        valid: false,
        error: `File too large. Maximum size: ${maxSizeMB}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload file to R2
   */
  public async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    if (!this.client || !this.isConfigured) {
      throw new Error('R2 service not configured');
    }

    // Validate file
    const validation = this.validateFile(mimeType, buffer.length, options.fileType);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const key = this.generateFileKey(originalName, options);

    // Retry logic with exponential backoff
    const maxRetries = 2; // Total 3 attempts (initial + 2 retries)
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create a timeout promise (30 seconds)
        const uploadPromise = this.client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
            Metadata: {
              originalName,
              uploadedAt: new Date().toISOString(),
              ...(options.userId && { userId: options.userId }),
            },
          })
        );

        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('Upload timeout after 30 seconds'));
          }, 30000);
        });

        try {
          await Promise.race([uploadPromise, timeoutPromise]);
          clearTimeout(timeoutId!);
        } catch (error) {
          clearTimeout(timeoutId!);
          throw error;
        }

        logger.info('File uploaded to R2', { 
          key, 
          size: buffer.length, 
          mimeType,
          attempt: attempt + 1,
        });

        const result: UploadResult = {
          key,
          url: await this.getSignedUrl(key),
          size: buffer.length,
          mimeType,
          originalName,
        };

        // Add public URL if configured and file is public
        if (this.publicUrl && options.isPublic) {
          result.publicUrl = `${this.publicUrl}/${key}`;
        }

        return result;
      } catch (error: any) {
        lastError = error;
        
        const isTimeout = error?.code === 'ETIMEDOUT' || 
                         error?.name === 'TimeoutError' ||
                         error?.message?.includes('timeout') ||
                         error?.message?.includes('ETIMEDOUT');

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn(`R2 upload attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
            key,
            error: error?.message || 'Unknown error',
            isTimeout,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
          // All retries exhausted
          const errorDetails = {
            message: error instanceof Error ? error.message : 'Unknown error',
            code: error?.Code || error?.code || error?.$metadata?.httpStatusCode,
            name: error?.name,
            requestId: error?.$metadata?.requestId,
            httpStatusCode: error?.$metadata?.httpStatusCode,
            key,
            attempts: attempt + 1,
          };
          
          logger.error('Failed to upload file to R2 after all retries', errorDetails);
          
          // Create a more informative error message
          const errorMessage = errorDetails.code 
            ? `R2 upload failed: ${errorDetails.code} - ${errorDetails.message}`
            : `R2 upload failed: ${errorDetails.message || 'Unknown error'}`;
          
          throw new Error(errorMessage);
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Upload failed');
  }

  /**
   * Delete file from R2
   */
  public async delete(key: string): Promise<boolean> {
    if (!this.client || !this.isConfigured) {
      throw new Error('R2 service not configured');
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      logger.info('File deleted from R2', { key });
      return true;
    } catch (error) {
      logger.error('Failed to delete file from R2', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      return false;
    }
  }

  /**
   * Get signed URL for private file access
   */
  public async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!this.client || !this.isConfigured) {
      throw new Error('R2 service not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      logger.error('Failed to get signed URL', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key,
      });
      throw error;
    }
  }

  /**
   * Get public URL for file
   */
  public getPublicUrl(key: string): string | null {
    if (!this.publicUrl) {
      return null;
    }
    return `${this.publicUrl}/${key}`;
  }

  /**
   * Check if file exists
   */
  public async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConfigured) {
      return false;
    }

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  public async getMetadata(key: string): Promise<FileMetadata | null> {
    if (!this.client || !this.isConfigured) {
      return null;
    }

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );

      return {
        key,
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
      };
    } catch {
      return null;
    }
  }

  /**
   * List files in a folder
   */
  public async listFiles(
    prefix: string,
    maxKeys: number = 100
  ): Promise<FileMetadata[]> {
    if (!this.client || !this.isConfigured) {
      return [];
    }

    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          MaxKeys: maxKeys,
        })
      );

      return (response.Contents || []).map((item) => ({
        key: item.Key || '',
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
      }));
    } catch (error) {
      logger.error('Failed to list files', {
        error: error instanceof Error ? error.message : 'Unknown error',
        prefix,
      });
      return [];
    }
  }

  /**
   * Generate presigned upload URL (for direct browser uploads)
   */
  public async getPresignedUploadUrl(
    originalName: string,
    mimeType: string,
    options: UploadOptions,
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; key: string; publicUrl?: string }> {
    if (!this.client || !this.isConfigured) {
      throw new Error('R2 service not configured');
    }

    const key = this.generateFileKey(originalName, options);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });

    return {
      uploadUrl,
      key,
      ...(this.publicUrl && options.isPublic && { publicUrl: `${this.publicUrl}/${key}` }),
    };
  }

  /**
   * Check if R2 is configured
   */
  public isR2Configured(): boolean {
    return this.isConfigured;
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ status: 'up' | 'down'; message?: string }> {
    if (!this.isConfigured) {
      return { status: 'down', message: 'Not configured' };
    }

    try {
      await this.client!.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          MaxKeys: 1,
        })
      );
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const r2Service = R2Service.getInstance();
export default r2Service;
