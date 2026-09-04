// 共享常量字典 —— 与 docs/API_CONTRACT.md §1 完全一致（唯一事实源）
// 前后端共用，禁止硬编码枚举值，一律从本文件引用。

export const Role = { STUDENT: 'STUDENT', CREATOR: 'CREATOR', ADMIN: 'ADMIN' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const WorkStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  TAKEN_DOWN: 'TAKEN_DOWN',
} as const;
export type WorkStatus = (typeof WorkStatus)[keyof typeof WorkStatus];

export const Quality = { NORMAL: 'NORMAL', HIGH: 'HIGH', SELECTED: 'SELECTED' } as const;
export type Quality = (typeof Quality)[keyof typeof Quality];

export const FileType = {
  PDF: 'PDF',
  MD: 'MD',
  DOC: 'DOC',
  DOCX: 'DOCX',
  PPT: 'PPT',
  PPTX: 'PPTX',
  ZIP: 'ZIP',
  IMAGE: 'IMAGE',
  OTHER: 'OTHER',
} as const;
export type FileType = (typeof FileType)[keyof typeof FileType];

// ===== V3 分类体系：一级大类（用途） + 二级预设标签池 =====
export const Category = {
  COURSE: 'COURSE',
  EXAM: 'EXAM',
  CAREER: 'CAREER',
  TUTOR: 'TUTOR',
  LIFE: 'LIFE',
  CAMPUS: 'CAMPUS',
} as const;
export type CategoryKey = (typeof Category)[keyof typeof Category];

export const CATEGORIES = [
  { key: 'COURSE', label: '课程学习', icon: '🎓', desc: '期末复习 · 题库 · 课件 · 笔记' },
  { key: 'EXAM', label: '升学备考', icon: '🧗', desc: '四六级 · 考研 · 保研 · 留学考试' },
  { key: 'CAREER', label: '求职实习', icon: '💼', desc: '实习经历 · 简历 · 面试 · 校招' },
  { key: 'TUTOR', label: '家教教案', icon: '📖', desc: '各科教案 · 辅导材料 · 家教经验' },
  { key: 'LIFE', label: '生活成长', icon: '🌱', desc: '健身 · 技能 · 理财 · 时间管理' },
  { key: 'CAMPUS', label: '新生引路', icon: '🏫', desc: '选课 · 报到 · 宿舍 · 社团 · 校园生活' },
] as const;

/** 预设标签池：按大类分组。上传表单按所选大类展示该组 chips（多选 ≤5），另允许自填 1 个自定义标签。 */
export const PRESET_TAGS: Record<CategoryKey, string[]> = {
  COURSE: ['期末复习', '题库真题', '课堂笔记', '课件PPT', '实验报告', '课程设计', '习题答案'],
  EXAM: ['四级', '六级', '考研', '保研', '雅思', '托福', '专升本'],
  CAREER: ['实习经历', '简历模板', '面试经验', '校招攻略', '求职复盘'],
  TUTOR: ['数学教案', '英语教案', '理科教案', '文科教案', '全科辅导', '家教经验'],
  LIFE: ['健身总结', '技能学习', '理财入门', '时间管理', '读书笔记', '减肥打卡'],
  CAMPUS: [
    '选课攻略',
    '报到流程',
    '军训生存',
    '宿舍生活',
    '社团指南',
    '校园地图',
    '开学考试',
    '英语分级',
    '转专业',
    '食堂测评',
    '校园卡',
    '生活费攻略',
  ],
};

export const CATEGORY_LABEL: Record<CategoryKey, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
) as Record<CategoryKey, string>;

export const PayMethod = { WECHAT: 'WECHAT', ALIPAY: 'ALIPAY', MOCK: 'MOCK' } as const;
export type PayMethod = (typeof PayMethod)[keyof typeof PayMethod];

export const PayStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
  CLOSED: 'CLOSED',
  FAILED: 'FAILED',
} as const;
export type PayStatus = (typeof PayStatus)[keyof typeof PayStatus];

export const IncomeStatus = {
  PENDING: 'PENDING',
  SETTLED: 'SETTLED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type IncomeStatus = (typeof IncomeStatus)[keyof typeof IncomeStatus];

export const PayoutStatus = {
  REQUESTED: 'REQUESTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
} as const;
export type PayoutStatus = (typeof PayoutStatus)[keyof typeof PayoutStatus];

export const ReportReason = {
  INFRINGEMENT: 'INFRINGEMENT',
  PIRACY: 'PIRACY',
  MISMATCH: 'MISMATCH',
  PORN_GAMBLE_ILLEGAL: 'PORN_GAMBLE_ILLEGAL',
  SPAM: 'SPAM',
  OTHER: 'OTHER',
} as const;
export type ReportReason = (typeof ReportReason)[keyof typeof ReportReason];

export const ReportTargetType = {
  WORK: 'WORK',
  COMMENT: 'COMMENT',
  RATING: 'RATING',
  USER: 'USER',
} as const;
export type ReportTargetType = (typeof ReportTargetType)[keyof typeof ReportTargetType];

/** 举报原因文案（V3-6） */
export const REPORT_REASONS: { key: ReportReason; label: string; desc: string }[] = [
  { key: 'INFRINGEMENT', label: '侵权盗用', desc: '抄袭、盗用他人原创资料' },
  { key: 'PIRACY', label: '盗版资源', desc: '上传付费课程/书籍等盗版内容' },
  { key: 'MISMATCH', label: '货不对板', desc: '内容与标题简介严重不符' },
  { key: 'PORN_GAMBLE_ILLEGAL', label: '违法违规', desc: '色情、赌博、诈骗等违法信息' },
  { key: 'SPAM', label: '垃圾广告', desc: '广告刷量、无关内容' },
  { key: 'OTHER', label: '其他', desc: '—' },
];

export const NotificationType = {
  FOLLOW_NEW_WORK: 'FOLLOW_NEW_WORK',
  INCOME: 'INCOME',
  ARRIVED: 'ARRIVED',
  RATING_REPLIED: 'RATING_REPLIED',
  AUDIT_RESULT: 'AUDIT_RESULT',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const DynamicType = { PUBLISH: 'PUBLISH', UPDATE: 'UPDATE', CHECKIN: 'CHECKIN' } as const;
export type DynamicType = (typeof DynamicType)[keyof typeof DynamicType];

export const QualityBadge: Record<Quality, string | null> = {
  NORMAL: null,
  HIGH: '⭐',
  SELECTED: '🏅',
};

export const ReportStatus = {
  OPEN: 'OPEN',
  PROCESSING: 'PROCESSING',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const AuditAction = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  TAKE_DOWN: 'TAKE_DOWN',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
  DELETE: 'DELETE',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// ===== V4 公告 =====
export const AnnounceLevel = { NORMAL: 'NORMAL', IMPORTANT: 'IMPORTANT' } as const;
export type AnnounceLevel = (typeof AnnounceLevel)[keyof typeof AnnounceLevel];

export const ANNOUNCE_LEVELS: { key: AnnounceLevel; label: string; desc: string }[] = [
  { key: 'NORMAL', label: '普通', desc: '常规通知，弹窗默认样式' },
  { key: 'IMPORTANT', label: '重要', desc: '重要公告，弹窗与列表高亮展示' },
];

// ===== V4 学习路线图 =====
export const RoadmapCategory = {
  BACKEND: 'BACKEND',
  FRONTEND: 'FRONTEND',
  AI: 'AI',
  ALGORITHM: 'ALGORITHM',
  EXAM: 'EXAM',
  OTHER: 'OTHER',
} as const;
export type RoadmapCategory = (typeof RoadmapCategory)[keyof typeof RoadmapCategory];

export const ROADMAP_CATEGORIES: { key: RoadmapCategory; label: string; icon: string }[] = [
  { key: 'BACKEND', label: '后端开发', icon: '☕' },
  { key: 'FRONTEND', label: '前端开发', icon: '🎨' },
  { key: 'AI', label: '人工智能', icon: '🤖' },
  { key: 'ALGORITHM', label: '算法竞赛', icon: '🧩' },
  { key: 'EXAM', label: '升学备考', icon: '🧗' },
  { key: 'OTHER', label: '其他方向', icon: '🗺' },
];

export const ROADMAP_CATEGORY_LABEL: Record<RoadmapCategory, string> = Object.fromEntries(
  ROADMAP_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<RoadmapCategory, string>;

export const EduVerifyStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type EduVerifyStatus = (typeof EduVerifyStatus)[keyof typeof EduVerifyStatus];

export const UserStatus = { ACTIVE: 'ACTIVE', BANNED: 'BANNED', DELETED: 'DELETED' } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const OrderBizType = { PURCHASE: 'PURCHASE' } as const;
export type OrderBizType = (typeof OrderBizType)[keyof typeof OrderBizType];

export const AchievementKey = {
  HELP_50: 'HELP_50',
  HELP_1000: 'HELP_1000',
  FIRST_FIVE_STAR: 'FIRST_FIVE_STAR',
  WEEKLY_HOT: 'WEEKLY_HOT',
  COLLEGE_EXCELLENT: 'COLLEGE_EXCELLENT',
  FIRST_INCOME: 'FIRST_INCOME',
} as const;
export type AchievementKey = (typeof AchievementKey)[keyof typeof AchievementKey];

export const MAX_FILE_SIZE = 209715200; // 200MB
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

/** V7 全站免费（支付封存）：NEXT_PUBLIC_PAYMENT_MODE=off 时前端统一按免费展示/交互。
 *  构建期由 Dockerfile ARG 注入（默认 off，fail-safe）；服务端同口径开关在 server/lib/payments.ts。 */
export const FREE_MODE = process.env.NEXT_PUBLIC_PAYMENT_MODE === 'off';
