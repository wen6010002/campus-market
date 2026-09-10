/**
 * DeepSeek 审核客户端（V12）——零依赖 fetch，模式同 mailer.ts（Resend）。
 *
 * 任务形态：单条 ≤600 字中文评论三分类（approve 放行 / reject 拒绝 / review 转人工），
 * json_object 输出保证可解析。成本 ≈ ¥0.001/次。
 * 网络：开发机与海外服务器均可直连（国内无需代理）。
 * 缺 key：直接抛错——worker 任务重试耗尽后 fail-closed 转人工（绝不无审核放行）；
 * 生产启动由 env.ts assertProdEnv 提前拦截缺 key。
 */
import { logger } from '../lib/logger';

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';
const TIMEOUT_MS = 15_000;

export interface ModerationVerdict {
  verdict: 'approve' | 'reject' | 'review';
  /** 违规类别（reject/review 时有值） */
  category?: string;
  /** 20 字内中文理由（通知作者与管理端展示） */
  reason?: string;
}

export const CATEGORY_LABEL: Record<string, string> = {
  politics: '涉政有害',
  porn: '色情低俗',
  gambling_fraud: '赌博诈骗引流',
  abuse: '辱骂攻击',
  campus_illegal: '违规服务（代考代写等）',
  other: '其他违规',
};

const SYSTEM_PROMPT = `你是深大校园知识分享平台的评论审核员。平台无备案、海外服务器，被举报风险高，审核从严格。
违规类别：
- politics 涉政敏感（攻击政府/领导人、政治动员、煽动性政治言论）
- porn 色情低俗
- gambling_fraud 赌博、诈骗、刷单、传销、兼职骗局、站外引流导流
- abuse 辱骂攻击、人身攻击、地域/性别歧视
- campus_illegal 代考代写、买卖答案、代签代跑等学术不端或违规有偿服务
- other 其他违法违规（毒品、枪爆、自杀教唆、违法犯罪教唆等）
判定标准：正常学习讨论、课程资料交流、友好提问、无攻击性的吐槽 = approve；明确违规 = reject；擦边或拿不准 = review。宁可 review，不要把可疑内容放成 approve。
只输出 JSON：{"verdict":"approve|reject|review","category":"类别英文或空串","reason":"20字内中文理由，approve时为空串"}`;

export class ModerationDisabledError extends Error {
  constructor() {
    super('审核服务未配置（DEEPSEEK_API_KEY）');
    this.name = 'ModerationDisabledError';
  }
}

/** 单条文本审核。网络错误/超时/响应畸形一律抛错，由调用方（worker 任务）重试并 fail-closed。 */
export async function reviewText(text: string): Promise<ModerationVerdict> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new ModerationDisabledError();

  const res = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 2000) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 200,
      stream: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  let parsed: ModerationVerdict;
  try {
    parsed = JSON.parse(raw) as ModerationVerdict;
  } catch {
    logger.warn({ raw: raw.slice(0, 200) }, 'DeepSeek 返回非 JSON，视为审核失败');
    throw new Error('DeepSeek 响应不可解析');
  }
  if (parsed.verdict !== 'approve' && parsed.verdict !== 'reject' && parsed.verdict !== 'review') {
    throw new Error(`DeepSeek verdict 非法: ${String(parsed.verdict)}`);
  }
  return parsed;
}
