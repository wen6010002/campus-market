import pino from 'pino';

// 结构化日志。生产可用 pino-http 挂 requestId；敏感字段（密码/钱包/邮箱）在调用处脱敏。
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: ['password', 'passwordHash', 'passwordPepper', 'verifyCode', '*.password'],
    censor: '[redacted]',
  },
});
