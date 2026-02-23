import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_PRIVATE_BUCKET = process.env.R2_PRIVATE_BUCKET || 'waigo-private';
export const R2_PUBLIC_BUCKET = process.env.R2_PUBLIC_BUCKET || 'waigo-public';

const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

export async function uploadToR2(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

export async function getFromR2(bucket: string, key: string): Promise<Readable> {
  const response = await r2Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`No body returned for R2 key: ${key}`);
  return response.Body as Readable;
}

export async function bufferFromR2(bucket: string, key: string): Promise<Buffer> {
  const stream = await getFromR2(bucket, key);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function deleteFromR2(bucket: string, key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_BASE_URL}/${key}`;
}

/** Returns true if filePath looks like an R2 object key rather than a local disk path. */
export function isR2Key(filePath: string): boolean {
  return filePath.startsWith('literature/') || filePath.startsWith('videos/');
}
