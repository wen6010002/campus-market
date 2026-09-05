// 共享数据类型 —— 与 docs/API_CONTRACT.md §3 一致。
// 注意：B1/B2 落地 zod 后，这些类型将改为从 `src/lib/zod/*` 的 `z.infer` 推导并 re-export，
// 本文件仅作为 F0 阶段的临时类型源，命名与字段与契约严格一致，不引入偏差。
import type {
  Role,
  Quality,
  WorkStatus,
  FileType,
  CategoryKey,
  PayMethod,
  PayStatus,
  IncomeStatus,
  PayoutStatus,
  ReportReason,
  ReportTargetType,
  NotificationType,
  DynamicType,
  AnnounceLevel,
  RoadmapCategory,
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
  hasAvatar?: boolean;
  avatarVer?: number;
  bio?: string;
  student?: StudentProfile;
  creator?: CreatorProfile | null;
  unreadCount: number;
  unreadAnnouncements?: number;
}

export interface WorkAuthor {
  id: string;
  username: string;
  avatarColor: string;
  hasAvatar?: boolean;
  avatarVer?: number;
  verified: boolean;
  /** V8 展示成就（作品卡作者名旁，一枚；无则 null） */
  badge?: {
    key: string;
    title: string;
    rarity: string;
    symbol: string;
    description?: string | null;
  } | null;
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
  hasCover?: boolean;
  category: CategoryKey;
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
  myLiked?: boolean;
  myAccess?: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface CreatorSummary {
  id: string;
  username: string;
  avatarColor: string;
  hasAvatar?: boolean;
  avatarVer?: number;
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

/** 用户主页（V3-5 /users/:id） */
export interface UserProfile {
  id: string;
  username: string;
  role?: string;
  avatarColor: string;
  hasAvatar: boolean;
  avatarVer?: number;
  bio: string;
  direction: string;
  honor: string | null;
  college: string;
  major: string;
  grade: string;
  verified: boolean;
  isCreator: boolean;
  helped: number;
  fans: number;
  following: number;
  works: number;
  rate: string;
  myFollow: boolean;
  isSelf: boolean;
  /** V8 佩戴勋章栏（≤5，公开；无佩戴为空数组） */
  badges: {
    key: string;
    title: string;
    rarity: string;
    symbol: string;
    expiresAt: string | null;
  }[];
}

/** 关注/粉丝行卡（V3-5） */
export interface FollowRow {
  id: string;
  username: string;
  avatarColor: string;
  hasAvatar: boolean;
  avatarVer?: number;
  bio: string;
  college: string;
  verified: boolean;
  fans: number;
  myFollow: boolean;
  isSelf: boolean;
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
  hasSample?: boolean;
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
  user: {
    id: string;
    username: string;
    avatarColor: string;
    hasAvatar?: boolean;
    avatarVer?: number;
    /** V8 佩戴勋章（名字旁小徽章；无佩戴为 null） */
    badge?: {
      key: string;
      title: string;
      rarity: string;
      symbol: string;
      description?: string | null;
    } | null;
  };
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
  | { provider: 'alipay'; redirectUrl: string } // 码支付 payurl 跳转（V6，微信收款已下线）
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

export interface WorkWithStats {
  id: string;
  title: string;
  course: string;
  coverIcon: string;
  coverTheme: string;
  isFree: boolean;
  price: string;
  status: WorkStatus;
  quality: Quality;
  rating: string;
  ratingCount: number;
  downloads: number;
  favs: number;
  views: number;
  earnings: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface CreatorDataWork {
  id: string;
  title: string;
  views: number;
  downloads: number;
  favs: number;
  rating: string;
  price: string;
  isFree: boolean;
  earnings: string;
}

export interface CreatorData {
  works: CreatorDataWork[];
}

// ===== V4 公告 =====
export interface Announcement {
  id: string;
  title: string;
  content: string;
  level: AnnounceLevel;
  author: { id: string; username: string };
  publishedAt: string;
  deletedAt?: string | null;
}

// ===== V4 学习路线图 =====
export interface RoadmapStepLite {
  id: string;
  text: string;
  note?: string;
}

export interface RoadmapPhaseLite {
  title: string;
  desc: string;
  steps: RoadmapStepLite[];
}

/** 路线图列表项（不含 content） */
export interface RoadmapListItem {
  id: string;
  title: string;
  summary: string;
  category: RoadmapCategory;
  coverIcon: string;
  coverTheme: string;
  status: WorkStatus;
  stepsCount: number;
  favs: number;
  uploader: { id: string; username: string; role: Role; hasAvatar: boolean; avatarVer: number };
  publishedAt: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  myFav?: boolean;
}

/** 路线图详情（含解析后 content + 关联资料） */
export interface RoadmapDetail extends RoadmapListItem {
  content: { phases: RoadmapPhaseLite[] };
  works: WorkListItem[];
  experience?: string | null;
  hasCredential?: boolean;
}

/** 我的打卡进度 */
export interface RoadmapProgress {
  roadmapId: string;
  checked: { stepId: string; createdAt: string }[];
  byDay: Record<string, number>; // 'YYYY-MM-DD'（UTC+8）→ 当日完成步骤数
  streakDays: number;
  totalChecked: number;
  stepsCount: number;
}
