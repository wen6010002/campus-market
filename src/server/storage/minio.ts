import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// MinIO（S3 兼容）客户端 + presigned 直传/下载。
const bucket = process.env.S3_BUCKET ?? 'campus-market';

const clientOptions = {
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
  },
  forcePathStyle: true as const,
};
const internalEndpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';

// V7 双端点：服务端调用走内网（S3_ENDPOINT，如 http://minio:9000）；
// 给浏览器的 presigned URL 走对外地址（S3_PUBLIC_ENDPOINT，如 https://kedahub.cn，
// 由 Caddy 按 bucket 路径反代 minio —— 同域免 CORS，Host 保序保 SigV4 验签）。
// 不设 S3_PUBLIC_ENDPOINT 时两者一致（本地 dev / 测试的默认行为）。
const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT ?? internalEndpoint;

const s3 = new S3Client({ endpoint: internalEndpoint, ...clientOptions });
const s3Signer = new S3Client({ endpoint: publicEndpoint, ...clientOptions });

let bucketReady: Promise<void> | null = null;

/** 首次使用时初始化桶，避免新生产卷尚未执行 mc 初始化时上传失败。 */
async function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch (error: any) {
        if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
        try {
          await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        } catch (createError: any) {
          if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(createError?.name)) {
            throw createError;
          }
        }
      }
    })();
  }
  return bucketReady;
}

/** 直传 PUT（文件上传，5 分钟） */
export async function presignPut(key: string, contentType = 'application/octet-stream') {
  await ensureBucket();
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(s3Signer, cmd, { expiresIn: 300 });
}

/** 下载 GET（10 分钟，Content-Disposition: attachment） */
export async function presignGet(key: string, filename: string) {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });
  return getSignedUrl(s3Signer, cmd, { expiresIn: 600 });
}

/** 内联展示 GET（1 小时，inline）——封面 / 头像 / 预览 PDF 用（V3） */
export async function presignGetInline(key: string) {
  const cmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: 'inline',
  });
  return getSignedUrl(s3Signer, cmd, { expiresIn: 3600 });
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
  await ensureBucket();
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: typeof content === 'string' ? Buffer.from(content, 'utf8') : content,
    ContentType: contentType,
  });
  return s3.send(cmd);
}

/** 读取文本对象（路线图 md 服务端解析用，V4） */
export async function getObjectText(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const res = await s3.send(cmd);
  return await res.Body!.transformToString('utf-8');
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

/** 运维探针：只检查桶是否可访问，不创建桶、不读取业务对象。 */
export async function storageHealth(): Promise<void> {
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
}

export const S3_BUCKET = bucket;
