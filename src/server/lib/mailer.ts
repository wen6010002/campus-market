import { logger } from './logger';

// 邮件发送（Resend HTTP API，零依赖）。
// 弃用 nodemailer+163 SMTP：个人邮箱高频发验证码会被网易反垃圾判定为营销源，
// 导致验证码瘫痪。Resend 是发信服务商，专为程序化邮件设计，无此问题。
// 需要：RESEND_API_KEY + RESEND_FROM（已验证发信域，如 Kedahub <noreply@kedahub.cn>；
// 未验证域名仅能经 onboarding@resend.dev 发给自己注册邮箱）。
const RESEND_API = 'https://api.resend.com/emails';

export async function sendMail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // 开发/测试环境允许无邮件服务启动；生产缺失必须显式暴露，避免验证码假成功。
    logger.warn('RESEND_API_KEY 未配置，跳过发信');
    if (process.env.NODE_ENV === 'production') throw new Error('邮件服务未配置（RESEND_API_KEY）');
    return;
  }
  const from = process.env.RESEND_FROM ?? process.env.MAIL_FROM ?? '课搭 <onboarding@resend.dev>';
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend 发送失败 ${res.status}: ${body.slice(0, 300)}`);
  }
}

function codeHtml(code: string, extra: string) {
  return `<div style="font-family:sans-serif"><h3>课搭</h3><p>你的验证码是：</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p style="color:#888">${TTL_MIN} 分钟内有效，请勿泄露给他人。</p><p style="color:#888;font-size:12px">${extra}</p></div>`;
}

const TTL_MIN = process.env.VERIFY_CODE_TTL_MIN ?? 10;

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
