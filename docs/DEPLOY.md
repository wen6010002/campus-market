# Campus Market — 部署与启动手册

> 本文档是项目的**唯一部署启动入口**。覆盖本地开发、生产部署、真实支付上线、健康检查与运维 runbook、测试运行。

---

## 1. 前置条件

| 依赖    | 版本要求                  | 说明                                          |
| ------- | ------------------------- | --------------------------------------------- |
| Docker  | 24+（含 Compose v2）      | 本地/生产统一用容器起 PG/Redis/MinIO          |
| Node.js | 20 LTS（或 24，实测可用） | Next.js 14.2 运行环境                         |
| pnpm    | 10.x                      | 包管理（已配 `onlyBuiltDependencies` 白名单） |

> **端口约定**：PG 宿主端口用 **5433**（避开本机常驻 Homebrew PostgreSQL 的 5432），Redis 6379，MinIO 9000/9001，mailhog 1025/8025，Web 3000。

---

## 2. 本地开发启动

```bash
# 1. 起基础设施（PG / Redis / MinIO / mailhog，自动建桶 campus-market）
docker compose -f docker/docker-compose.yml up -d

# 2. 安装依赖
pnpm install

# 3. 准备环境变量
cp .env.example .env
# 修改 .env 中的 AUTH_SECRET、PASSWORD_PEPPER（可用 openssl rand -base64 32 生成）

# 4. 生成 Prisma client + 迁移 + 种子
pnpm prisma:generate
pnpm prisma:migrate:dev        # 首次；后续用 prisma:migrate:deploy
pnpm db:seed                   # 幂等，可重复执行

# 5. 启动（两个终端）
pnpm dev        # 终端 1：Web（http://localhost:3000）
pnpm worker     # 终端 2：定时任务（BullMQ）

# 6. 验证
curl http://localhost:3000/api/health          # {"ok":true,...}
open http://localhost:8025                     # mailhog 界面查看验证码
```

**演示账号**（种子内置，密码统一 `demo1234`）：

- 普通创作者：`demo@szu.edu.cn`
- 管理员：`admin@szu.edu.cn`
- 5 个示例创作者：`c_lin@stu.edu.cn` 等

**验证码**：注册流程发往 mailhog，在 http://localhost:8025 查看邮件中的 6 位码。

---

## 3. 环境变量清单（`.env`）

必填项标注 `#required`。完整字段见 `.env.example`，关键项：

| 变量                  | 说明                                    | 本地默认                                          |
| --------------------- | --------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`        | PG 连接串（直连，迁移用）               | `postgresql://cm:cm@localhost:5433/campus_market` |
| `DATABASE_URL_POOLED` | 运行时连接串（走 PgBouncer，可选）      | `postgresql://cm:cm@localhost:6433/campus_market` |
| `REDIS_URL`           | Redis 连接                              | `redis://localhost:6379`                          |
| `AUTH_SECRET`         | JWT 签名密钥（required）                | 随机生成                                          |
| `PASSWORD_PEPPER`     | 密码 pepper（required）                 | 随机生成                                          |
| `S3_*`                | MinIO 地址/密钥/桶                      | `localhost:9000` / `minioadmin`                   |
| `PAYMENT_MODE`        | `mock` \| `wechat` \| `alipay` \| `all` | `mock`                                            |
| `SMTP_HOST/PORT`      | 邮件（本地 mailhog）                    | `localhost:1025`                                  |
| `PLATFORM_FEE_RATE`   | 平台抽成                                | `0.1`（10%）                                      |
| `INCOME_SETTLE_DAYS`  | T+N 结算                                | `7`                                               |

---

## 4. 生产部署

### 4.1 准备

```bash
# 服务器上拉代码
git pull
cp .env.example .env          # 填生产值：DOMAIN、支付密钥、AUTH_SECRET 等
```

### 4.2 一键部署（docker compose prod）

```bash
docker compose -f docker/docker-compose.prod.yml up -d --build
```

服务清单：

- `app`：Next.js（standalone 构建，`restart: unless-stopped`，健康检查 `/api/health`）
- `worker`：BullMQ 定时任务（结算/质量/订单超时/通知清理）
- `postgres` / `redis` / `minio`：持久化卷
- `caddy`：TLS 反代（自动签发证书，域名配 `DOMAIN`）
- `backup`：每日 `pg_dump` 备份（保留最近 7 份）

### 4.3 首次初始化（迁移 + 种子）

```bash
# 在 app 容器内执行迁移与种子
docker compose -f docker/docker-compose.prod.yml exec app sh -c "pnpm prisma:migrate:deploy && pnpm db:seed"
```

### 4.4 滚动更新

```bash
git pull
docker compose -f docker/docker-compose.prod.yml up -d --build app worker
```

---

## 5. 真实支付上线

本地/E2E 用 `PAYMENT_MODE=mock`（下单即成功，走完整收益事务）。生产切真实支付需提供：

**微信支付 v3**（Native）：

```env
PAYMENT_MODE=wechat
WECHAT_APPID=wx...
WECHAT_MCHID=商户号
WECHAT_API_V3_KEY=32位APIv3密钥
WECHAT_SERIAL_NO=商户证书序列号
WECHAT_PRIVATE_KEY_PATH=./certs/wechat.pem   # 商户私钥
WECHAT_NOTIFY_URL=https://你的域名/api/v1/webhooks/pay/wechat
```

证书放到项目 `certs/`（已在 `.gitignore`，不入库）。

**支付宝**（电脑网站支付）：

```env
PAYMENT_MODE=alipay
ALIPAY_APP_ID=应用ID
ALIPAY_PRIVATE_KEY=应用私钥
ALIPAY_PUBLIC_KEY=支付宝公钥
ALIPAY_NOTIFY_URL=https://你的域名/api/v1/webhooks/pay/alipay
```

> 真实下单代码已就绪（`src/server/payment/{wechat,alipay}.ts`，RSA 签名/验签/AES-GCM 解密用 `node:crypto` 自封），只需注入密钥。回调验签失败时路由不 ack，支付方会自动重试。

---

## 6. 健康检查与运维 runbook

### 6.1 健康检查

```
GET /api/health   → {"ok":true,"uptime":...}
```

三依赖（DB/Redis/MinIO）ping 在 `src/app/api/health/route.ts`。

### 6.2 日志

- 应用日志：`docker logs -f cm-app`（Pino 结构化，敏感字段脱敏）
- 定时任务日志：`docker logs -f cm-worker`

### 6.3 常见 5xx 排查

| 现象         | 排查                                          |
| ------------ | --------------------------------------------- |
| 500 兜底     | 看 app 日志 `unhandled route error`（Pino）   |
| 支付回调 500 | 验签失败/解密失败，看日志 + 证书是否就位      |
| 评分并发死锁 | 已用「先锁 Work 行再 INSERT」规避（PG 40P01） |

### 6.4 备份与恢复

- 自动：`cm-backup` 容器每日 `pg_dump` 到 `backups` 卷（保留 7 份）。
- 手动恢复：`pg_restore -h postgres -U cm -d campus_market /backups/cm_xxx.dump`

### 6.5 数据库迁移回滚

- Prisma **不支持 down 迁移**；回滚 = 新写一个反方向迁移 + `migrate deploy`。

---

## 7. 测试运行

```bash
pnpm test             # 单元 + 集成（需 docker 起 PG/Redis，测试库 campus_market_test）
pnpm test:cov         # 覆盖率（单测阈值 90%，集成 85%）
pnpm test:integration # 仅集成
pnpm test:e2e         # Playwright E2E（PAYMENT_MODE=mock，7 条核心路径）
```

> 测试前置：`docker compose -f docker/docker-compose.yml up -d` 起 PG/Redis/MinIO；测试库 `campus_market_test` 会在集成测试 `beforeAll` 自动 `db push` 同步 schema。

---

## 附：分阶段进度

实现进度与每阶段反思见 [`PROGRESS.md`](./PROGRESS.md)；API 契约见 [`API_CONTRACT.md`](./API_CONTRACT.md)。
