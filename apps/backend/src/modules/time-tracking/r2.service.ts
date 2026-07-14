import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private s3Client: S3Client | null = null;
  private bucketName: string;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME || 'trackflow-screenshots';

    if (endpoint && accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        region: 'auto',
      });
    } else {
      console.warn(
        '⚠️ Cloudflare R2 credentials not fully configured. Falling back to Mock mode.',
      );
    }
  }

  async getPresignedUploadUrl(
    objectKey: string,
    contentType = 'image/webp',
  ): Promise<string> {
    if (!this.s3Client) {
      // Mock mode fallback
      return `http://localhost:3000/mock-r2/${this.bucketName}/${objectKey}`;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    // Link expires in 15 minutes (900 seconds)
    return getSignedUrl(this.s3Client, command, { expiresIn: 900 });
  }

  async uploadBuffer(
    objectKey: string,
    buffer: Buffer,
    contentType = 'image/webp',
  ): Promise<void> {
    if (!this.s3Client) {
      // Mock mode: persist to local disk so /uploads/* static server can serve it
      const { join } = await import('path');
      const { mkdirSync, writeFileSync } = await import('fs');
      const filePath = join(process.cwd(), 'uploads', objectKey);
      mkdirSync(join(filePath, '..'), { recursive: true });
      writeFileSync(filePath, buffer);
      console.log(`[Mock R2] Saved file locally: ${filePath}`);
      return;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }

  async deleteObject(objectKey: string): Promise<void> {
    if (!this.s3Client) {
      console.log(`[Mock R2] Deleted object: ${objectKey}`);
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });

    try {
      await this.s3Client.send(command);
    } catch (err) {
      console.error(
        `[R2Service Error] Failed to delete object ${objectKey}:`,
        err,
      );
    }
  }

  isConfigured(): boolean {
    return this.s3Client !== null;
  }

  async getObjectStream(objectKey: string) {
    if (!this.s3Client) return null;
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
    });
    const response = await this.s3Client.send(command);
    return response.Body;
  }
}
