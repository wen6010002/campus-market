// 全局测试 setup —— 接入 test DB（让 server/db.ts 单例指向测试库）、redis、支付 mock。
import 'dotenv/config';

process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-32-bytes-minimum-length';
process.env.PAYMENT_MODE = process.env.PAYMENT_MODE ?? 'mock';
// 让全局 prisma 单例（src/server/db.ts）指向测试库
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
// 关键：单例优先取 DATABASE_URL_POOLED（.env 里指向 dev 库的 PgBouncer）。
// 注意必须「显式赋值」而不能 delete——@prisma/client import 时会自动加载 .env 并回填缺失变量，
// delete 掉的 POOLED 会被重新填回 dev 库地址，导致集成测试清空开发库。
process.env.DATABASE_URL_POOLED = process.env.DATABASE_URL;
