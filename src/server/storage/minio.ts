import { S3Client } from '@aws-sdk/client-s3';
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// MinIO（S3 兼容）客户端 + presigned 直传/下载。
const bucket = process.env.S3_BUCKET ?? 'campus-market';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
  },
  forcePathStyle: true,
});

/** 直传 PUT（文件上传，5 分钟） */
export async function presignPut(key: string, contentType = 'application/octet-stream') {
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn: 300 });
}

/** 下载 GET（10 分钟，Content-Disposition: attachment） */
export async function presignGet(key: string, filename: string) {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });
  return getSignedUrl(s3, cmd, { expiresIn: 600 });
}

/** 内联展示 GET（1 小时，inline）——封面 / 头像 / 预览 PDF 用（V3） */
export async function presignGetInline(key: string) {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: 'inline',
  });
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

/** 校验对象存在 + 大小匹配（发布前） */
export async function headObject(key: string) {
  const cmd = new HeadObjectCommand({ Bucket: bucket, Key: key });
  return s3.send(cmd);
}

/** 直接上传对象（种子/测试用） */
export async function putObject(
  key: string,
  content: string | Buffer,
  contentType = 'application/octet-stream',
) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: typeof content === 'string' ? Buffer.from(content, 'utf8') : content,
    ContentType: contentType,
  });
  return s3.send(cmd);
}

/** 判断对象是否存在 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await headObject(key);
    return true;
  } catch {
    return false;
  }
}

export const S3_BUCKET = bucket;
