// 生产种子：学校/学院/专业（落 StudentProfile 字段）+ Achievement 字典 + 评分标签 + 5 示例创作者 + 作品。
// 幂等：全部 upsert，可重复执行。数据沿用原型 campus-market-v3/assets/app.js。
import 'dotenv/config';
import {
  PrismaClient,
  Role,
  FileType,
  Quality,
  PayMethod,
  PayStatus,
  IncomeStatus,
  Category,
} from '@prisma/client';
import { hashPassword } from '../src/server/auth/password';
import { putObject, objectExists } from '../src/server/storage/minio';

const prisma = new PrismaClient();

// 演示账号统一密码：demo1234（供前端联调/E2E 登录）
export const DEMO_PASSWORD = 'demo1234';

/** 生成最小合法 PDF（种子作品占位文件，下载后可正常打开） */
function makeDemoPdf(): Buffer {
  const stream = 'BT /F1 20 Tf 72 720 Td (Campus Market - Demo File) Tj ET';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += obj;
  }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 0; i < objects.length; i++) {
    pdf += `${String(offsets[i + 1]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

// ---------- 工具 ----------
function toBytes(s: string): number {
  const m = s.match(/([\d.]+)\s*(KB|MB|GB)/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === 'GB') return Math.round(n * 1024 ** 3);
  if (unit === 'MB') return Math.round(n * 1024 ** 2);
  return Math.round(n * 1024);
}

function toViews(s: string | number): number {
  if (typeof s === 'number') return s;
  const m = s.match(/([\d.]+)(k)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2] ? Math.round(n * 1000) : Math.round(n);
}

function toFileType(s: string): FileType {
  if (/pdf/i.test(s) && !/代码|文档|音频|视频/i.test(s)) return FileType.PDF;
  if (/代码|zip/i.test(s)) return FileType.ZIP;
  return FileType.OTHER;
}

function toQuality(q: string): Quality {
  if (q === 'selected') return Quality.SELECTED;
  if (q === 'high') return Quality.HIGH;
  return Quality.NORMAL;
}

// ---------- 成就字典（6） ----------
const ACHIEVEMENTS = [
  { key: 'HELP_50' as const, emoji: '🏆', title: '帮助 50 位同学' },
  { key: 'HELP_1000' as const, emoji: '🏆', title: '帮助 1000 位同学' },
  { key: 'FIRST_FIVE_STAR' as const, emoji: '⭐', title: '首个五星作品' },
  { key: 'WEEKLY_HOT' as const, emoji: '🔥', title: '本周热门创作者' },
  { key: 'COLLEGE_EXCELLENT' as const, emoji: '🎓', title: '学院优秀创作者' },
  { key: 'FIRST_INCOME' as const, emoji: '💰', title: '首次获得收益' },
];

// ---------- 评分标签（正/负） ----------
const RATING_TAGS = [
  { name: '内容详细', isPositive: true },
  { name: '排版清晰', isPositive: true },
  { name: '内容准确', isPositive: true },
  { name: '很有帮助', isPositive: true },
  { name: '性价比高', isPositive: true },
  { name: '通俗易懂', isPositive: true },
  { name: '内容过时', isPositive: false },
  { name: '与描述不符', isPositive: false },
  { name: '内容质量一般', isPositive: false },
  { name: '排版混乱', isPositive: false },
];

// ---------- 创作者（5 + 演示用户 u0） ----------
const CREATORS = [
  {
    id: 'c_lin',
    ini: '林',
    color: '#FF6B4A',
    name: '林知行',
    college: '计算机与软件学院',
    major: '计算机科学与技术',
    direction: '数据库方向',
    grade: '大三',
    honor: '数据库 97 分 · 三年一等奖学金',
    bio: '数据库方向，相信好的笔记能帮一个人也能帮一群人。把期末复习、项目经验整理成可复用的资料。',
  },
  {
    id: 'c_su',
    ini: '苏',
    color: '#A855F7',
    name: '苏漫',
    college: '计算机与软件学院',
    major: '软件工程',
    direction: 'AI 方向',
    grade: '大四',
    honor: 'AI 实验室核心 · 累计帮助 5w+',
    bio: 'AI 方向，从传统后端转到 Agent 开发。坚持把每个项目拆成可上手的小步骤，反对故弄玄虚。',
  },
  {
    id: 'c_chen',
    ini: '陈',
    color: '#10B981',
    name: '陈昱',
    college: '电子与信息工程学院',
    major: '电子信息',
    direction: '考研 408',
    grade: '研一',
    honor: '408 考研 412 分',
    bio: '刚上岸的考研人。把自己备考时整理的 408 笔记和真题套路分享出来，希望后来人少走弯路。',
  },
  {
    id: 'c_zhou',
    ini: '周',
    color: '#E8638F',
    name: '周柠',
    college: '外国语学院',
    major: '英语',
    direction: '四六级 / 留学',
    grade: '大三',
    honor: '专四优秀 · 六级 610+',
    bio: '英语专业，踩过四六级的坑也走过留学的路。相信方法比苦功重要，把套路整理成清单。',
  },
  {
    id: 'c_he',
    ini: '何',
    color: '#6366F1',
    name: '何思远',
    college: '计算机与软件学院',
    major: '软件工程',
    direction: '操作系统 / 底层',
    grade: '大三',
    honor: 'OS 课程助教 · 内核小项目作者',
    bio: '喜欢钻底层。把操作系统的抽象概念画成图、写成故事，让晦涩的东西变得可读。',
  },
];

const DEMO_USER = {
  id: 'u0',
  ini: '温',
  color: '#FF6B4A',
  name: '温昊璇',
  college: '计算机与软件学院',
  major: '计算机科学与技术',
  direction: 'Java 后端 / AI Agent',
  grade: '大二',
  honor: 'Java 后端转 AI Agent',
  bio: '正在从 Java 后端转向 AI Agent 方向。喜欢把踩过的坑整理成笔记分享出去，目前已经帮助 86 位同学。',
};

// ---------- 作品（沿用原型 WORKS） ----------
type WorkSeed = {
  id: string;
  creatorId: string;
  ic: string;
  g: string;
  free: boolean;
  quality: string;
  name: string;
  desc: string;
  tags: string[];
  course: string;
  fileType: string;
  fileSize: string;
  pages: number;
  rating: number;
  ratingCount: number;
  dist: [number, number, number, number, number];
  downloads: number;
  favs: number;
  likes: number;
  views: string | number;
  major: string | null;
  grade: string | null;
  crowd: string | null;
  toc: string[];
  price?: number;
  old?: number;
};

const WORKS: WorkSeed[] = [
  {
    id: 'w_db1',
    creatorId: 'c_lin',
    ic: '🗄️',
    g: 'g-db',
    free: true,
    quality: 'high',
    name: '数据库期末押题（含真题回忆版）',
    desc: '王老师课程核心考点 + ER 图 + 范式题精讲，去年帮助 582 位同学稳过。',
    tags: ['数据库', '押题', '期末复习'],
    course: '数据库原理',
    fileType: 'PDF',
    fileSize: '8.2 MB',
    pages: 48,
    rating: 4.9,
    ratingCount: 128,
    dist: [110, 13, 3, 1, 1],
    downloads: 582,
    favs: 156,
    likes: 328,
    views: '5.2k',
    major: '计算机 / 软件',
    grade: '大二 / 大三',
    crowd: '期末冲刺',
    toc: [
      '第一章 关系数据库基础',
      '第二章 ER 模型与设计',
      '第三章 关系代数',
      '第四章 SQL 进阶',
      '第五章 范式与函数依赖',
      '第六章 期末真题精讲',
    ],
  },
  {
    id: 'w_agent',
    creatorId: 'c_su',
    ic: '🤖',
    g: 'g-ai',
    free: true,
    quality: 'high',
    name: 'Spring AI Agent 入门笔记（可运行）',
    desc: 'Function Calling / RAG / 记忆全覆盖，配套 GitHub 项目，零基础上手。',
    tags: ['AI', 'Agent', '课堂笔记'],
    course: 'AI 应用开发',
    fileType: 'PDF',
    fileSize: '24.6 MB',
    pages: 72,
    rating: 4.95,
    ratingCount: 96,
    dist: [88, 6, 1, 1, 0],
    downloads: 1240,
    favs: 298,
    likes: 512,
    views: '8.7k',
    major: '计算机 / 软件',
    grade: '大二及以上',
    crowd: '想入门 Agent 的同学',
    toc: [
      '第一章 大模型 API 调用',
      '第二章 Prompt 工程基础',
      '第三章 Function Calling',
      '第四章 RAG 检索增强',
      '第五章 Memory 与多轮对话',
      '第六章 Agent 编排',
      '第七章 完整项目实战',
    ],
  },
  {
    id: 'w_dsmap',
    creatorId: 'c_chen',
    ic: '🗺️',
    g: 'g-ds',
    free: true,
    quality: 'normal',
    name: '数据结构知识导图合集（12 张）',
    desc: '把整本书压成 12 张大图，红黑树 / 图论 / DP 全可视化。',
    tags: ['数据结构', '课堂笔记', '导图'],
    course: '数据结构',
    fileType: 'PDF',
    fileSize: '18.4 MB',
    pages: 12,
    rating: 4.8,
    ratingCount: 64,
    dist: [48, 12, 3, 1, 0],
    downloads: 880,
    favs: 367,
    likes: 421,
    views: '6.1k',
    major: '计算机相关',
    grade: '大一 / 大二',
    crowd: '期末 + 考研',
    toc: ['线性表与链表', '栈与队列', '树与二叉树', '图论基础'],
  },
  {
    id: 'w_guide',
    creatorId: 'c_lin',
    ic: '🏫',
    g: 'g-cet',
    free: true,
    quality: 'high',
    name: '大二选课避坑指南（深大版）',
    desc: '学长血泪整理：哪些课给分高、哪些课慎选、抢课技巧全收录。',
    tags: ['选课攻略', '校园攻略', '原创'],
    course: '校园攻略',
    fileType: 'PDF',
    fileSize: '3.1 MB',
    pages: 22,
    rating: 4.85,
    ratingCount: 152,
    dist: [120, 24, 6, 2, 0],
    downloads: 1620,
    favs: 723,
    likes: 891,
    views: '12k',
    major: '全专业',
    grade: '大一 / 大二',
    crowd: '深大学生',
    toc: ['给分红黑榜', '慎选课程清单', '抢课实操技巧', '通识选修推荐', '避坑问答'],
  },
  {
    id: 'w_aitool',
    creatorId: 'c_su',
    ic: '⚡',
    g: 'g-math',
    free: true,
    quality: 'selected',
    name: '学生可白嫖的 AI 工具清单（32 个）',
    desc: 'ChatGPT / Claude / Cursor 教育认证 + 免费 API，亲测可用。',
    tags: ['技能学习', 'AI工具', '工具'],
    course: '效率工具',
    fileType: 'PDF',
    fileSize: '2.4 MB',
    pages: 16,
    rating: 4.92,
    ratingCount: 188,
    dist: [168, 14, 4, 1, 1],
    downloads: 2400,
    favs: 1102,
    likes: 1240,
    views: '18k',
    major: '全专业',
    grade: '全年级',
    crowd: '想用 AI 提效的同学',
    toc: ['对话类工具', '编程类工具', '教育认证清单', '免费 API 汇总'],
  },
  {
    id: 'w_os',
    creatorId: 'c_he',
    ic: '💻',
    g: 'g-os',
    free: true,
    quality: 'normal',
    name: '操作系统概念图谱（手绘版）',
    desc: '进程 / 内存 / IO 全覆盖，期末复习效率翻倍，附思维导图源文件。',
    tags: ['操作系统', '课堂笔记', '导图'],
    course: '操作系统',
    fileType: 'PDF',
    fileSize: '14.2 MB',
    pages: 18,
    rating: 4.88,
    ratingCount: 72,
    dist: [58, 10, 3, 1, 0],
    downloads: 510,
    favs: 198,
    likes: 267,
    views: '4.3k',
    major: '计算机 / 软件',
    grade: '大二 / 大三',
    crowd: '期末复习',
    toc: ['进程与线程', 'CPU 调度', '内存管理', '文件系统', 'IO 与死锁'],
  },
  {
    id: 'w_net',
    creatorId: 'c_lin',
    ic: '🌐',
    g: 'g-net',
    free: true,
    quality: 'normal',
    name: '计算机网络·自顶向下重点整理',
    desc: 'OSI / TCP 全层笔记，三次握手 / 拥塞控制全图解，期末+面试通用。',
    tags: ['计网', '期末复习', '免费'],
    course: '计算机网络',
    fileType: 'PDF',
    fileSize: '6.8 MB',
    pages: 36,
    rating: 4.82,
    ratingCount: 58,
    dist: [44, 10, 3, 1, 0],
    downloads: 470,
    favs: 245,
    likes: 334,
    views: '5.8k',
    major: '计算机相关',
    grade: '大二 / 大三',
    crowd: '期末 + 面试',
    toc: ['应用层 HTTP', '传输层 TCP', '网络层 IP', '数据链路层', '网络安全基础'],
  },
  {
    id: 'w_ml',
    creatorId: 'c_su',
    ic: '🧠',
    g: 'g-ml',
    free: true,
    quality: 'normal',
    name: '机器学习·吴恩达课程中文精简笔记',
    desc: '线性回归到神经网络，公式推导 + 代码示例，Coursera 配套。',
    tags: ['机器学习', '课堂笔记', '原创'],
    course: '机器学习',
    fileType: 'PDF',
    fileSize: '11.5 MB',
    pages: 54,
    rating: 4.78,
    ratingCount: 44,
    dist: [30, 11, 2, 1, 0],
    downloads: 380,
    favs: 312,
    likes: 389,
    views: '7.2k',
    major: '计算机 / 统计',
    grade: '大三及以上',
    crowd: 'ML 入门',
    toc: ['线性回归', '逻辑回归', '正则化', '神经网络', '反向传播', '实战建议'],
  },
  {
    id: 'w_juc',
    creatorId: 'c_su',
    ic: '☕',
    g: 'g-java',
    free: false,
    quality: 'high',
    name: 'Java 并发编程核心面试题（JUC 详解）',
    desc: 'synchronized 到 AQS、线程池到 CompletableFuture，大厂高频 48 题全解。',
    tags: ['Java', '面试经验', '精品'],
    course: 'Java 进阶',
    fileType: 'PDF',
    fileSize: '15.3 MB',
    pages: 86,
    rating: 4.9,
    ratingCount: 104,
    dist: [88, 12, 3, 1, 0],
    downloads: 577,
    favs: 433,
    likes: 577,
    views: '9.4k',
    major: '计算机 / 软件',
    grade: '大三 / 求职',
    crowd: 'Java 求职',
    toc: [
      '线程基础与生命周期',
      '锁机制 synchronized',
      'JUC 与 AQS',
      '线程池原理',
      'CompletableFuture',
    ],
    price: 9.9,
    old: 19.9,
  },
  {
    id: 'w_408ds',
    creatorId: 'c_chen',
    ic: '📘',
    g: 'g-408',
    free: false,
    quality: 'high',
    name: '408 全套笔记·数据结构篇（手绘版）',
    desc: '每一章一张图，配 200 道精选真题与详细题解，考研冲刺必备。',
    tags: ['考研', '408', '精品'],
    course: '考研 408',
    fileType: 'PDF',
    fileSize: '28.7 MB',
    pages: 120,
    rating: 4.94,
    ratingCount: 86,
    dist: [78, 6, 2, 0, 0],
    downloads: 680,
    favs: 678,
    likes: 845,
    views: '14k',
    major: '计算机相关',
    grade: '考研',
    crowd: '408 考研人',
    toc: ['时间复杂度', '线性结构', '树与哈夫曼', '图论算法', '查找与排序', '真题精选 200 道'],
    price: 19.9,
    old: 29.9,
  },
  {
    id: 'w_line',
    creatorId: 'c_zhou',
    ic: '⊞',
    g: 'g-line',
    free: true,
    quality: 'normal',
    name: '线性代数期末速通笔记（含题型套路）',
    desc: '行列式 / 矩阵 / 特征值三大块套路，10 套真题分类精解。',
    tags: ['线代', '期末复习', '免费'],
    course: '线性代数',
    fileType: 'PDF',
    fileSize: '5.6 MB',
    pages: 30,
    rating: 4.7,
    ratingCount: 38,
    dist: [26, 9, 2, 1, 0],
    downloads: 420,
    favs: 178,
    likes: 223,
    views: '3.9k',
    major: '理工科',
    grade: '大一 / 大二',
    crowd: '期末速通',
    toc: ['行列式计算', '矩阵运算', '特征值与对角化', '真题套路'],
  },
  {
    id: 'w_javard',
    creatorId: 'c_su',
    ic: '🚀',
    g: 'g-java',
    free: false,
    quality: 'selected',
    name: 'Java 后端实习路线（18 章·含面经）',
    desc: '从 SpringBoot 到分布式到大厂实习复盘，苏漫的完整成长路径。',
    tags: ['Java', '实习经历', '校招攻略', '精品'],
    course: 'Java 后端',
    fileType: 'PDF',
    fileSize: '32.0 MB',
    pages: 180,
    rating: 4.93,
    ratingCount: 72,
    dist: [64, 7, 1, 0, 0],
    downloads: 480,
    favs: 512,
    likes: 560,
    views: '8.8k',
    major: '计算机 / 软件',
    grade: '大二至求职',
    crowd: 'Java 求职',
    toc: [
      'Java 基础与 JVM',
      'SpringBoot 实战',
      'MySQL 与 Redis',
      '分布式与中间件',
      '微服务与容器',
      '大厂实习面经',
    ],
    price: 29.9,
    old: 49.9,
  },
  {
    id: 'w_408all',
    creatorId: 'c_chen',
    ic: '📚',
    g: 'g-408',
    free: false,
    quality: 'selected',
    name: '408 考研全套笔记 + 真题精解',
    desc: '数据结构 / 计组 / OS / 网络四件套，陈昱 412 分亲测，帮助 2100+ 人。',
    tags: ['考研', '408', '精品'],
    course: '考研 408',
    fileType: 'PDF',
    fileSize: '68.0 MB',
    pages: 320,
    rating: 4.97,
    ratingCount: 142,
    dist: [134, 6, 2, 0, 0],
    downloads: 845,
    favs: 690,
    likes: 820,
    views: '16k',
    major: '计算机相关',
    grade: '考研',
    crowd: '408 全程',
    toc: [
      '数据结构篇',
      '计算机组成原理',
      '操作系统',
      '计算机网络',
      '真题分类精解',
      '冲刺模拟卷',
      '复试与调剂',
    ],
    price: 39.9,
    old: 59.9,
  },
  {
    id: 'w_dbadv',
    creatorId: 'c_lin',
    ic: '🔧',
    g: 'g-db',
    free: false,
    quality: 'high',
    name: '数据库系统进阶：从原理到项目实战',
    desc: '林知行数据库 97 分笔记 + 选课系统完整项目代码与讲解。',
    tags: ['数据库', '课程设计', '精品'],
    course: '数据库',
    fileType: 'PDF',
    fileSize: '42.0 MB',
    pages: 96,
    rating: 4.91,
    ratingCount: 58,
    dist: [50, 6, 2, 0, 0],
    downloads: 328,
    favs: 280,
    likes: 330,
    views: '5.6k',
    major: '计算机 / 软件',
    grade: '大二 / 大三',
    crowd: '想写项目的同学',
    toc: ['存储与索引原理', '事务与锁', 'SQL 调优', '选课系统设计', '项目代码精讲'],
    price: 24.9,
    old: 39.9,
  },
  {
    id: 'w_cet6',
    creatorId: 'c_zhou',
    ic: '📖',
    g: 'g-cet',
    free: false,
    quality: 'normal',
    name: '六级 600+ 冲刺：听说读写全套方案',
    desc: '周柠 610 分方法论，30 天计划表 + 高频词伙 + 真题解析。',
    tags: ['六级', '四六级', '精品'],
    course: '四六级',
    fileType: 'PDF',
    fileSize: '56.0 MB',
    pages: 140,
    rating: 4.85,
    ratingCount: 64,
    dist: [52, 9, 2, 1, 0],
    downloads: 287,
    favs: 210,
    likes: 265,
    views: '4.8k',
    major: '全专业',
    grade: '备考六级',
    crowd: '六级冲刺',
    toc: ['30 天计划表', '听力精听法', '阅读套路', '翻译写作模板', '真题解析'],
    price: 19.9,
    old: 29.9,
  },
  {
    id: 'w_agentpro',
    creatorId: 'c_su',
    ic: '🤖',
    g: 'g-ai',
    free: false,
    quality: 'selected',
    name: 'AI Agent 项目实战：从 0 搭一个智能体',
    desc: '苏漫打磨 3 个月的完整项目课，RAG + 记忆 + 多轮对话，含源码。',
    tags: ['AI', 'Agent', '课程设计', '精品'],
    course: 'AI 实战',
    fileType: 'PDF',
    fileSize: '1.2 GB',
    pages: 0,
    rating: 4.96,
    ratingCount: 48,
    dist: [44, 3, 1, 0, 0],
    downloads: 512,
    favs: 380,
    likes: 430,
    views: '7.4k',
    major: '计算机相关',
    grade: '大三及以上',
    crowd: '想做 Agent 项目的同学',
    toc: ['项目架构设计', 'RAG 知识库搭建', '工具调用编排', '记忆与规划', '上线与评估'],
    price: 49.9,
    old: 89.9,
  },
  {
    id: 'w_math30',
    creatorId: 'c_chen',
    ic: '📐',
    g: 'g-math',
    free: false,
    quality: 'normal',
    name: '考研数学高数 30 讲（手写笔记）',
    desc: '武忠祥基础班全套手写笔记，例题全解，标注重点与易错。',
    tags: ['考研', '数学', '精品'],
    course: '考研数学',
    fileType: 'PDF',
    fileSize: '38.0 MB',
    pages: 160,
    rating: 4.84,
    ratingCount: 52,
    dist: [40, 9, 2, 1, 0],
    downloads: 421,
    favs: 330,
    likes: 380,
    views: '6.2k',
    major: '理工科',
    grade: '考研',
    crowd: '考研数学',
    toc: ['极限与连续', '导数与微分', '中值定理', '积分', '多元微积分'],
    price: 24.9,
    old: 39.9,
  },
  {
    id: 'w_my1',
    creatorId: 'u0',
    ic: '☀️',
    g: 'g-java',
    free: false,
    quality: 'normal',
    name: 'SpringBoot 三天入门笔记（含可运行 Demo）',
    desc: '从 0 搭一个 REST API 项目，注解 + 源码 + 踩坑全记录。',
    tags: ['Java', 'SpringBoot', '课堂笔记'],
    course: 'Java 后端',
    fileType: 'PDF',
    fileSize: '12.0 MB',
    pages: 42,
    rating: 4.8,
    ratingCount: 22,
    dist: [18, 3, 1, 0, 0],
    downloads: 96,
    favs: 48,
    likes: 72,
    views: '1.4k',
    major: '计算机相关',
    grade: '大一 / 大二',
    crowd: 'SpringBoot 入门',
    toc: ['环境与起步', '注解速查', 'REST API 实战', '常见踩坑'],
    price: 9.9,
    old: 14.9,
  },
  {
    id: 'w_my2',
    creatorId: 'u0',
    ic: '🗂️',
    g: 'g-db',
    free: true,
    quality: 'normal',
    name: 'MySQL 索引原理图解（B+ 树可视化）',
    desc: '把 B+ 树、聚簇索引、回表、覆盖索引画成图，一看就懂。',
    tags: ['MySQL', '课堂笔记', '免费'],
    course: '数据库',
    fileType: 'PDF',
    fileSize: '4.2 MB',
    pages: 18,
    rating: 4.7,
    ratingCount: 12,
    dist: [9, 2, 1, 0, 0],
    downloads: 140,
    favs: 62,
    likes: 88,
    views: '1.8k',
    major: '计算机相关',
    grade: '全年级',
    crowd: '面试 / 期末',
    toc: ['B+ 树结构', '聚簇与辅助索引', '回表与覆盖索引', '索引优化实战'],
  },
  {
    id: 'w_my3',
    creatorId: 'u0',
    ic: '🌿',
    g: 'g-os',
    free: true,
    quality: 'normal',
    name: 'Git 团队协作实战手册',
    desc: '分支策略 + 冲突解决 + 常见翻车恢复，团队协作不再互相甩锅。',
    tags: ['Git', '技能学习', '免费'],
    course: '工程工具',
    fileType: 'PDF',
    fileSize: '2.0 MB',
    pages: 20,
    rating: 4.6,
    ratingCount: 8,
    dist: [6, 1, 1, 0, 0],
    downloads: 88,
    favs: 34,
    likes: 46,
    views: '980',
    major: '全专业',
    grade: '全年级',
    crowd: '团队协作',
    toc: ['分支模型', '冲突解决', '翻车恢复', '团队规范'],
  },

  // ===== V3-7 新生引路（免费 · 开学季运营内容） =====
  {
    id: 'w_fresh1',
    creatorId: 'c_lin',
    ic: '🗓️',
    g: 'g-cet',
    free: true,
    quality: 'high',
    name: '深大选课全攻略：通识课红黑榜与抢课技巧',
    desc: '给分、作业量、点名频率全标注，抢课时间线与退补选规则一篇讲清。',
    tags: ['选课攻略', '校园攻略'],
    course: '校园攻略',
    fileType: 'PDF',
    fileSize: '4.2 MB',
    pages: 26,
    rating: 4.9,
    ratingCount: 210,
    dist: [188, 16, 4, 1, 1],
    downloads: 3100,
    favs: 1520,
    likes: 1980,
    views: '22k',
    major: '全专业',
    grade: '大一',
    crowd: '选课期新生',
    toc: ['通识课红黑榜', '专业课怎么排', '抢课时间线', '退补选规则'],
  },
  {
    id: 'w_fresh2',
    creatorId: 'c_zhou',
    ic: '🔤',
    g: 'g-cet',
    free: true,
    quality: 'high',
    name: '英语分级考全解：题型、分数线与复习重点',
    desc: '分级考决定你大一英语从哪级读起。题型拆解 + 三天冲刺清单 + 高频语法点。',
    tags: ['英语分级', '开学考试'],
    course: '大学英语',
    fileType: 'PDF',
    fileSize: '2.8 MB',
    pages: 18,
    rating: 4.85,
    ratingCount: 168,
    dist: [148, 15, 4, 1, 0],
    downloads: 2450,
    favs: 1120,
    likes: 1380,
    views: '18k',
    major: '全专业',
    grade: '大一',
    crowd: '分级考新生',
    toc: ['分级规则', '题型精讲', '三天冲刺清单', '高频语法'],
  },
  {
    id: 'w_fresh3',
    creatorId: 'c_he',
    ic: '🌞',
    g: 'g-os',
    free: true,
    quality: 'normal',
    name: '军训生存指南：物品清单与防暑贴士',
    desc: '防晒、鞋垫、水壶怎么带；拉练、内务、会操流程；请假与补训规则。',
    tags: ['军训生存'],
    course: '校园攻略',
    fileType: 'PDF',
    fileSize: '1.9 MB',
    pages: 14,
    rating: 4.8,
    ratingCount: 132,
    dist: [114, 13, 4, 1, 0],
    downloads: 2800,
    favs: 1350,
    likes: 1650,
    views: '21k',
    major: '全专业',
    grade: '大一',
    crowd: '军训新生',
    toc: ['物品清单', '一日流程', '防暑与恢复', '请假规则'],
  },
  {
    id: 'w_fresh4',
    creatorId: 'c_lin',
    ic: '🛏️',
    g: 'g-db',
    free: true,
    quality: 'high',
    name: '深大宿舍全对比：床位、卫浴、外卖点',
    desc: '各园区宿舍实拍对比：上床下桌还是上下铺、独立卫浴概率、快递与外卖到哪取。',
    tags: ['宿舍生活'],
    course: '校园攻略',
    fileType: 'PDF',
    fileSize: '6.4 MB',
    pages: 20,
    rating: 4.88,
    ratingCount: 154,
    dist: [136, 13, 4, 1, 0],
    downloads: 2600,
    favs: 1480,
    likes: 1720,
    views: '19k',
    major: '全专业',
    grade: '大一',
    crowd: '住宿新生',
    toc: ['园区对比', '床位类型', '卫浴情况', '快递外卖'],
  },
  {
    id: 'w_fresh5',
    creatorId: 'c_su',
    ic: '🎭',
    g: 'g-ai',
    free: true,
    quality: 'normal',
    name: '社团怎么选：百团大战避坑指南',
    desc: '兴趣社、学术队、学生会、义工联——各类社团的时间成本与真实收获。',
    tags: ['社团指南'],
    course: '校园攻略',
    fileType: 'PDF',
    fileSize: '2.2 MB',
    pages: 16,
    rating: 4.75,
    ratingCount: 96,
    dist: [82, 10, 3, 1, 0],
    downloads: 1900,
    favs: 890,
    likes: 1120,
    views: '14k',
    major: '全专业',
    grade: '大一',
    crowd: '社团招新期',
    toc: ['社团分类', '时间成本表', '面试套路', '退社规则'],
  },
  {
    id: 'w_fresh6',
    creatorId: 'c_chen',
    ic: '🗺️',
    g: 'g-ds',
    free: true,
    quality: 'normal',
    name: '校园地图标注版：教学楼、食堂、快递点',
    desc: '哪栋楼在哪、最近食堂怎么走、快递驿站分区——打印一张贴宿舍门后。',
    tags: ['校园地图'],
    course: '校园攻略',
    fileType: 'PDF',
    fileSize: '5.1 MB',
    pages: 8,
    rating: 4.82,
    ratingCount: 118,
    dist: [100, 14, 3, 1, 0],
    downloads: 3300,
    favs: 1780,
    likes: 2050,
    views: '26k',
    major: '全专业',
    grade: '大一',
    crowd: '所有新生',
    toc: ['总图', '教学区', '生活区', '快递驿站'],
  },
  {
    id: 'w_fresh7',
    creatorId: 'c_zhou',
    ic: '📋',
    g: 'g-line',
    free: true,
    quality: 'normal',
    name: '新生报到一天流程：材料清单与时间线',
    desc: '从下车站到宿舍铺好床的完整动线：报到点、缴费、户口迁移、电话卡怎么办。',
    tags: ['报到流程', '校园卡'],
    course: '校园攻略',
    fileType: 'PDF',
    fileSize: '2.5 MB',
    pages: 12,
    rating: 4.86,
    ratingCount: 142,
    dist: [124, 14, 3, 1, 0],
    downloads: 2900,
    favs: 1560,
    likes: 1830,
    views: '24k',
    major: '全专业',
    grade: '大一',
    crowd: '报到日新生',
    toc: ['材料清单', '报到动线', '缴费与户口', '校园卡办理'],
  },
  {
    id: 'w_fresh8',
    creatorId: 'c_he',
    ic: '🔄',
    g: 'g-java',
    free: true,
    quality: 'high',
    name: '转专业政策与真实经验帖',
    desc: '各学院转出入口、绩点门槛、面试笔试内容，三位学长学姐的完整转专业复盘。',
    tags: ['转专业'],
    course: '校园攻略',
    fileType: 'PDF',
    fileSize: '3.6 MB',
    pages: 24,
    rating: 4.84,
    ratingCount: 87,
    dist: [74, 10, 2, 1, 0],
    downloads: 1250,
    favs: 720,
    likes: 890,
    views: '9.8k',
    major: '全专业',
    grade: '大一 / 大二',
    crowd: '想转专业的同学',
    toc: ['政策总览', '各院门槛', '备考清单', '三份复盘'],
  },
];

// ---------- V3 分类映射：id → 用途大类（回填存量 + 新建统一走这里） ----------
const WORK_CATEGORY: Record<string, Category> = {
  w_db1: 'COURSE',
  w_agent: 'COURSE',
  w_dsmap: 'COURSE',
  w_guide: 'CAMPUS',
  w_aitool: 'LIFE',
  w_os: 'COURSE',
  w_net: 'COURSE',
  w_ml: 'COURSE',
  w_juc: 'CAREER',
  w_408ds: 'EXAM',
  w_line: 'COURSE',
  w_javard: 'CAREER',
  w_408all: 'EXAM',
  w_dbadv: 'COURSE',
  w_cet6: 'EXAM',
  w_agentpro: 'COURSE',
  w_math30: 'EXAM',
  w_my1: 'COURSE',
  w_my2: 'COURSE',
  w_my3: 'LIFE',
  // V3-7 新生引路
  w_fresh1: 'CAMPUS',
  w_fresh2: 'CAMPUS',
  w_fresh3: 'CAMPUS',
  w_fresh4: 'CAMPUS',
  w_fresh5: 'CAMPUS',
  w_fresh6: 'CAMPUS',
  w_fresh7: 'CAMPUS',
  w_fresh8: 'CAMPUS',
};

// ---------- V3 预设标签池（与 src/lib/constants.ts PRESET_TAGS 保持一致，全量落 Tag 表） ----------
const PRESET_TAG_POOL: string[] = [
  '期末复习',
  '题库真题',
  '课堂笔记',
  '课件PPT',
  '实验报告',
  '课程设计',
  '习题答案',
  '四级',
  '六级',
  '考研',
  '保研',
  '雅思',
  '托福',
  '专升本',
  '实习经历',
  '简历模板',
  '面试经验',
  '校招攻略',
  '求职复盘',
  '数学教案',
  '英语教案',
  '理科教案',
  '文科教案',
  '全科辅导',
  '家教经验',
  '健身总结',
  '技能学习',
  '理财入门',
  '时间管理',
  '读书笔记',
  '减肥打卡',
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
];

async function main() {
  console.log('🌱 开始种子…');

  // 1. 成就
  for (const a of ACHIEVEMENTS) {
    await prisma.achievement.upsert({ where: { key: a.key }, update: {}, create: a });
  }

  // 2. 评分标签 + V3 预设标签池
  for (const t of RATING_TAGS) {
    await prisma.ratingTag.upsert({ where: { name: t.name }, update: {}, create: t });
  }
  for (const t of PRESET_TAG_POOL) {
    await prisma.tag.upsert({ where: { name: t }, update: {}, create: { name: t } });
  }

  // 3. 创作者 + 演示用户
  const demoHash = await hashPassword(DEMO_PASSWORD);
  const users = [...CREATORS, DEMO_USER];
  for (const c of users) {
    const isDemo = c.id === 'u0';
    await prisma.user.upsert({
      where: { id: c.id },
      update: {
        passwordHash: demoHash,
        passwordPepper: null,
        email: isDemo ? 'demo@szu.edu.cn' : `${c.id}@stu.edu.cn`,
      },
      create: {
        id: c.id,
        email: isDemo ? 'demo@szu.edu.cn' : `${c.id}@stu.edu.cn`,
        username: c.name,
        passwordHash: demoHash,
        role: Role.CREATOR,
        avatarColor: c.color,
        student: {
          create: {
            eduEmail: isDemo ? 'demo@szu.edu.cn' : `${c.id}@stu.edu.cn`,
            school: '深圳大学',
            college: c.college,
            major: c.major,
            grade: c.grade,
            verifyStatus: 'VERIFIED',
            verifiedAt: new Date(),
          },
        },
        creator: {
          create: {
            bio: c.bio,
            direction: c.direction,
            honor: c.honor,
            verified: true,
            reviewedAt: new Date(),
            wallet: { create: { balance: 0, pending: 0, withdrawn: 0 } },
          },
        },
      },
    });
  }

  // 管理员账号（供 admin 后台联调）
  await prisma.user.upsert({
    where: { id: 'u_admin' },
    update: { passwordHash: demoHash },
    create: {
      id: 'u_admin',
      email: 'admin@szu.edu.cn',
      username: '平台管理员',
      passwordHash: demoHash,
      role: Role.ADMIN,
      avatarColor: '#1A1D23',
      student: {
        create: {
          eduEmail: 'admin@szu.edu.cn',
          school: '深圳大学',
          college: '平台运营',
          major: '-',
          grade: '-',
          verifyStatus: 'VERIFIED',
          verifiedAt: new Date(),
        },
      },
    },
  });

  // 4. 作品 + 标签
  for (const w of WORKS) {
    await prisma.work.upsert({
      where: { id: w.id },
      // update 也写 category：保证存量行在重跑 seed 时回填大类
      update: { category: WORK_CATEGORY[w.id] ?? 'COURSE' },
      create: {
        id: w.id,
        authorId: w.creatorId,
        title: w.name,
        description: w.desc,
        course: w.course,
        fileType: toFileType(w.fileType),
        fileKey: `works/seed/${w.id}.pdf`,
        fileSize: toBytes(w.fileSize),
        pages: w.pages,
        coverIcon: w.ic,
        coverTheme: w.g,
        category: WORK_CATEGORY[w.id] ?? 'COURSE',
        isFree: w.free,
        price: w.price ?? 0,
        oldPrice: w.old ?? null,
        status: 'PUBLISHED',
        quality: toQuality(w.quality),
        copyrightAccepted: true,
        applyMajor: w.major,
        applyGrade: w.grade,
        applyCrowd: w.crowd,
        previewToc: w.toc,
        rating: w.rating,
        ratingCount: w.ratingCount,
        ratingDist: {
          '5': w.dist[0],
          '4': w.dist[1],
          '3': w.dist[2],
          '2': w.dist[3],
          '1': w.dist[4],
        },
        downloads: w.downloads,
        favs: w.favs,
        likes: w.likes,
        views: toViews(w.views),
        publishedAt: new Date('2026-08-01T00:00:00Z'),
      },
    });
    // 上传占位文件（幂等：已存在则跳过），否则下载会报 NoSuchKey
    const seedFileKey = `works/seed/${w.id}.pdf`;
    if (!(await objectExists(seedFileKey))) {
      await putObject(seedFileKey, makeDemoPdf(), 'application/pdf');
    }
    // 作品标签
    for (const t of w.tags) {
      const tag = await prisma.tag.upsert({ where: { name: t }, update: {}, create: { name: t } });
      await prisma.workTag.upsert({
        where: { workId_tagId: { workId: w.id, tagId: tag.id } },
        update: {},
        create: { workId: w.id, tagId: tag.id },
      });
    }
  }

  // 5. 演示用户社交态（关注/收藏/下载/订单）
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: 'u0', followingId: 'c_lin' } },
    update: {},
    create: { followerId: 'u0', followingId: 'c_lin' },
  });
  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: 'u0', followingId: 'c_su' } },
    update: {},
    create: { followerId: 'u0', followingId: 'c_su' },
  });
  for (const wid of ['w_agent', 'w_aitool', 'w_javard']) {
    await prisma.favorite.upsert({
      where: { userId_workId: { userId: 'u0', workId: wid } },
      update: {},
      create: { userId: 'u0', workId: wid },
    });
  }
  await prisma.download.upsert({
    where: { workId_userId: { workId: 'w_db1', userId: 'u0' } },
    update: {},
    create: { workId: 'w_db1', userId: 'u0' },
  });

  // CreatorIncome.creatorId 引用 CreatorProfile.id，需先解析
  const suProfile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: 'c_su' } });
  await prisma.order.upsert({
    where: { id: 'o_demo_1' },
    update: {},
    create: {
      id: 'o_demo_1',
      workId: 'w_juc',
      buyerId: 'u0',
      amount: 9.9,
      platformFee: 0.99,
      creatorAmount: 8.91,
      payMethod: PayMethod.MOCK,
      payStatus: PayStatus.PAID,
      transactionId: 'mock_seed_tx_1',
      paidAt: new Date(),
      income: {
        create: {
          creatorId: suProfile.id,
          amount: 8.91,
          status: IncomeStatus.PENDING,
          settleAt: new Date(Date.now() + 7 * 86400_000),
        },
      },
    },
  });

  // 6. 通知
  for (const n of [
    {
      type: 'FOLLOW_NEW_WORK' as const,
      text: '你关注的 <b>林知行</b> 发布了新作品《数据库期末押题》。',
      link: '/work/w_db1',
    },
    {
      type: 'INCOME' as const,
      text: '你的作品《SpringBoot 三天入门笔记》获得一笔收益 <b>¥8.91</b>。',
      link: '/income',
    },
  ]) {
    const exists = await prisma.notification.findFirst({ where: { userId: 'u0', text: n.text } });
    if (!exists) await prisma.notification.create({ data: { userId: 'u0', ...n } });
  }

  // 关注动态种子：u0 关注的三位创作者的作品动态（首页关注流演示数据）
  const DYNAMICS: {
    creatorId: string;
    type: 'PUBLISH' | 'UPDATE';
    workId: string;
    agoHours: number;
  }[] = [
    { creatorId: 'c_lin', type: 'PUBLISH', workId: 'w_guide', agoHours: 5 },
    { creatorId: 'c_chen', type: 'UPDATE', workId: 'w_dsmap', agoHours: 26 },
    { creatorId: 'c_he', type: 'PUBLISH', workId: 'w_os', agoHours: 49 },
    { creatorId: 'c_lin', type: 'PUBLISH', workId: 'w_net', agoHours: 120 },
  ];
  for (const d of DYNAMICS) {
    const exists = await prisma.dynamic.findFirst({
      where: { creatorId: d.creatorId, workId: d.workId, type: d.type },
    });
    if (!exists) {
      await prisma.dynamic.create({
        data: {
          creatorId: d.creatorId,
          type: d.type,
          workId: d.workId,
          createdAt: new Date(Date.now() - d.agoHours * 3600_000),
        },
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    works: await prisma.work.count(),
    achievements: await prisma.achievement.count(),
    ratingTags: await prisma.ratingTag.count(),
    tags: await prisma.tag.count(),
    follows: await prisma.follow.count(),
    favorites: await prisma.favorite.count(),
    downloads: await prisma.download.count(),
    orders: await prisma.order.count(),
    notifications: await prisma.notification.count(),
    dynamics: await prisma.dynamic.count(),
  };
  console.log('✅ 种子完成：', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
