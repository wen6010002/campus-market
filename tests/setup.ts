// 全局测试 setup —— 阶段 0 仅做环境准备，后续阶段在此接入 test DB / redis / minio testcard
import 'dotenv/config';

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-32-bytes-minimum-length';
process.env.PAYMENT_MODE = process.env.PAYMENT_MODE ?? 'mock';
