// 全局测试 setup —— 接入 test DB（让 server/db.ts 单例指向测试库）、redis、支付 mock。
import 'dotenv/config';

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-32-bytes-minimum-length';
process.env.PAYMENT_MODE = process.env.PAYMENT_MODE ?? 'mock';
// 让全局 prisma 单例（src/server/db.ts）指向测试库
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
