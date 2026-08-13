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
  DOC: 'DOC',
  DOCX: 'DOCX',
  PPT: 'PPT',
  PPTX: 'PPTX',
  ZIP: 'ZIP',
  IMAGE: 'IMAGE',
  OTHER: 'OTHER',
} as const;
export type FileType = (typeof FileType)[keyof typeof FileType];

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

export const ReportTargetType = { WORK: 'WORK', COMMENT: 'COMMENT', USER: 'USER' } as const;
export type ReportTargetType = (typeof ReportTargetType)[keyof typeof ReportTargetType];

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
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const AuditAction = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  TAKE_DOWN: 'TAKE_DOWN',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

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
