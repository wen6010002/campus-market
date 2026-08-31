import nodemailer from 'nodemailer';
import { logger } from './logger';

// 邮件发送（dev 用 mailhog/smtp4dev 本地接，生产接真实 SMTP）
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: Number(process.env.SMTP_PORT ?? 1025) === 465,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

export async function sendMail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? '课搭 <no-reply@kedahub.cn>',
      to,
      subject,
      html,
    });
  } catch (e) {
    // 邮件失败不阻断主流程（验证码可在 dev 从 mailhog 界面查看）
    logger.warn({ err: e }, 'sendMail failed');
  }
}

export async function sendVerifyCode(email: string, code: string) {
  await sendMail(
    email,
    '【课搭】邮箱验证码',
    `<div style="font-family:sans-serif"><h3>课搭</h3><p>你的验证码是：</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p style="color:#888">10 分钟内有效，请勿泄露给他人。</p></div>`,
  );
}
