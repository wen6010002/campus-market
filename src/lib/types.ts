// 共享数据类型 —— 与 docs/API_CONTRACT.md §3 一致。
// 注意：B1/B2 落地 zod 后，这些类型将改为从 `src/lib/zod/*` 的 `z.infer` 推导并 re-export，
// 本文件仅作为 F0 阶段的临时类型源，命名与字段与契约严格一致，不引入偏差。
import type {
  Role,
  Quality,
  WorkStatus,
  FileType,
  PayMethod,
  PayStatus,
  IncomeStatus,
  PayoutStatus,
  ReportReason,
  ReportTargetType,
  NotificationType,
  DynamicType,
} from './constants';

export interface StudentProfile {
  school: string;
  college: string;
  major: string;
  grade: string;
  verifyStatus: string;
}

export interface CreatorProfile {
  id: string;
  bio: string;
  direction: string;
  honor: string | null;
  verified: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  avatarColor: string;
  student?: StudentProfile;
  creator?: CreatorProfile | null;
  unreadCount: number;
}

export interface WorkAuthor {
  id: string;
  username: string;
  avatarColor: string;
  verified: boolean;
}

export interface WorkListItem {
  id: string;
  title: string;
  description: string;
  course: string;
  fileType: FileType;
  fileSize: number;
  pages: number;
  coverIcon: string;
  coverTheme: string;
  isFree: boolean;
  price: string;
  oldPrice: string | null;
  quality: Quality;
  status: WorkStatus;
  rating: string;
  ratingCount: number;
  downloads: number;
  favs: number;
  likes: number;
  views: string | number;
  tags: string[];
  author: WorkAuthor;
  myFav?: boolean;
  myAccess?: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface CreatorSummary {
  id: string;
  username: string;
  avatarColor: string;
  bio: string;
  direction: string;
  honor: string | null;
  college: string;
  major: string;
  verified: boolean;
  helped: number;
  fans: number;
  works: number;
  rate: string;
  myFollow?: boolean;
}

export interface RatingDist {
  '5': number;
  '4': number;
  '3': number;
  '2': number;
  '1': number;
}

export interface WorkDetail extends WorkListItem {
  previewToc: string[];
  applyMajor: string | null;
  applyGrade: string | null;
  applyCrowd: string | null;
  ratingDist: RatingDist;
  previewOnly: boolean;
  myRating?: { stars: number; text: string } | null;
  author: CreatorSummary;
}

export interface Rating {
  id: string;
  stars: number;
  text: string;
  helpfulCount: number;
  creatorReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  user: { username: string; avatarColor: string };
  tags: string[];
  _mine?: boolean;
}

export interface RatingSummary {
  rating: string;
  ratingCount: number;
  dist: RatingDist;
}

export interface Order {
  id: string;
  workId: string;
  buyerId: string;
  amount: string;
  payStatus: PayStatus;
  payMethod: PayMethod;
  paidAt: string | null;
  createdAt: string;
}

export type PayParams =
  | { provider: 'wechat'; codeUrl?: string; mwebUrl?: string }
  | { provider: 'alipay'; redirectUrl: string }
  | { provider: 'mock'; paid: true };

export interface CreateOrderResult {
  orderId: string;
  pay: PayParams;
  access?: boolean;
}

export interface DownloadResult {
  url: string;
  expiresIn: number;
}

export interface Dynamic {
  id: string;
  type: DynamicType;
  creator: CreatorSummary;
  work?: WorkListItem;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  text: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail: string | null;
  status: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  data: T[];
  pagination: Pagination;
}

export interface IncomeSummary {
  total: string;
  month: string;
  pending: string;
  withdrawable: string;
}

export interface CreatorOverview {
  helped: number;
  income: IncomeSummary;
  fans: number;
  avgRating: string;
  works: number;
  freeWorks: number;
  fineWorks: number;
}

export interface IncomeTx {
  id: string;
  workTitle: string;
  buyer: string;
  amount: string;
  method: PayMethod;
  createdAt: string;
  status: IncomeStatus;
}

export interface Payout {
  id: string;
  amount: string;
  method: PayMethod;
  status: PayoutStatus;
  requestedAt: string;
  completedAt: string | null;
  rejectedReason: string | null;
}
