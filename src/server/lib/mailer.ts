import nodemailer from 'nodemailer';
import { logger } from './logger';

// 邮件发送（dev 用 mailhog/smtp4dev 本地接，生产接真实 SMTP，如 smtp.163.com:465）
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: Number(process.env.SMTP_PORT ?? 1025) === 465,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  connectionTimeout: 10_000, // 防 SMTP 挂起拖死请求
});

const TTL_MIN = process.env.VERIFY_CODE_TTL_MIN ?? 10;

export async function sendMail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? '课搭 <no-reply@kedahub.cn>',
      to,
      subject,
      html,
    });
  } catch (e) {
    // 开发/测试环境允许无 SMTP 启动；生产必须显式暴露发送失败，避免验证码假成功。
    logger.warn({ err: e }, 'sendMail failed');
    if (process.env.NODE_ENV === 'production') throw e;
  }
}

function codeHtml(code: string, extra: string) {
  return `<div style="font-family:sans-serif"><h3>课搭</h3><p>你的验证码是：</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p style="color:#888">${TTL_MIN} 分钟内有效，请勿泄露给他人。</p><p style="color:#888;font-size:12px">${extra}</p></div>`;
}

export async function sendVerifyCode(email: string, code: string) {
  await sendMail(email, '【课搭】邮箱验证码', codeHtml(code, '你正在注册课搭账号。'));
}

export async function sendResetCode(email: string, code: string) {
  await sendMail(
    email,
    '【课搭】重置密码验证码',
    codeHtml(code, '你正在重置课搭账号密码，若非本人操作请忽略本邮件。'),
  );
}
