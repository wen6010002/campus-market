// V8 荣耀引擎成就字典 —— seed 与荣誉墙的单一事实源。
// 称号体系：「光」的成长线（微光→暖光→炬火→灯塔→星河→传灯）+ 校园语境四字系。
// 符号为 game-icons.net 剪影（CC BY 3.0），底座渲染见 src/components/medal/Medal.tsx。
export const ACHIEVEMENT_DICT = [
  // ---- 帮助轴：累计下载（=帮助了多少人），六阶稀有度 ----
  {
    key: 'HELP_10',
    emoji: '✨',
    title: '微光初现',
    rarity: 'bronze',
    symbol: 'spark',
    description: '累计帮助 10 位同学（资料被下载）',
  },
  {
    key: 'HELP_50',
    emoji: '💗',
    title: '暖光相伴',
    rarity: 'silver',
    symbol: 'heart',
    description: '累计帮助 50 位同学',
  },
  {
    key: 'HELP_100',
    emoji: '🔥',
    title: '星火成炬',
    rarity: 'gold',
    symbol: 'torch',
    description: '累计帮助 100 位同学',
  },
  {
    key: 'HELP_500',
    emoji: '🗼',
    title: '灯塔长明',
    rarity: 'plat',
    symbol: 'lighthouse',
    description: '累计帮助 500 位同学',
  },
  {
    key: 'HELP_1000',
    emoji: '🧭',
    title: '星河领航',
    rarity: 'diamond',
    symbol: 'compass',
    description: '累计帮助 1,000 位同学',
  },
  {
    key: 'HELP_10000',
    emoji: '🏮',
    title: '万人传灯',
    rarity: 'lgd',
    symbol: 'lantern',
    description: '累计帮助 10,000 位同学',
  },
  // ---- 点赞轴 ----
  {
    key: 'LIKES_10',
    emoji: '👍',
    title: '初获掌声',
    rarity: 'bronze',
    symbol: 'thumb',
    description: '作品累计获赞 10 次',
  },
  {
    key: 'LIKES_100',
    emoji: '👏',
    title: '掌声如潮',
    rarity: 'silver',
    symbol: 'hand',
    description: '作品累计获赞 100 次',
  },
  {
    key: 'LIKES_1000',
    emoji: '🌟',
    title: '全场起立',
    rarity: 'diamond',
    symbol: 'starwhirl',
    description: '作品累计获赞 1,000 次',
  },
  // ---- 收藏轴 ----
  {
    key: 'FAVS_10',
    emoji: '🔖',
    title: '初入书单',
    rarity: 'bronze',
    symbol: 'bookmark',
    description: '作品累计被收藏 10 次',
  },
  {
    key: 'FAVS_100',
    emoji: '📦',
    title: '镇馆之宝',
    rarity: 'gold',
    symbol: 'chest',
    description: '作品累计被收藏 100 次',
  },
  // ---- 作品轴 ----
  {
    key: 'FIRST_WORK',
    emoji: '📄',
    title: '第一份答卷',
    rarity: 'bronze',
    symbol: 'scroll',
    description: '首个作品通过审核上架',
  },
  {
    key: 'WORKS_10',
    emoji: '✒️',
    title: '笔耕不辍',
    rarity: 'silver',
    symbol: 'quill',
    description: '累计发布 10 个过审作品',
  },
  // ---- 好评 ----
  {
    key: 'FIRST_FIVE_STAR',
    emoji: '⭐',
    title: '满分卷面',
    rarity: 'gold',
    symbol: 'star',
    description: '作品首次获得五星好评',
  },
  // ---- 限时（到期自动收起，可卫冕）----
  {
    key: 'WEEKLY_HOT',
    emoji: '🔥',
    title: '燎原之火',
    rarity: 'gold',
    symbol: 'flame',
    description: '周下载榜 Top 3 · 限时 7 天',
  },
  {
    key: 'MONTHLY_STAR',
    emoji: '🌿',
    title: '月度桂冠',
    rarity: 'diamond',
    symbol: 'laurels',
    description: '月下载榜第 1 · 限时 30 天',
  },
  // ---- 人工授予 / 纪念 ----
  {
    key: 'COLLEGE_EXCELLENT',
    emoji: '🎓',
    title: '学院之光',
    rarity: 'plat',
    symbol: 'gradcap',
    description: '由平台授予的学院优秀创作者',
  },
  {
    key: 'FIRST_INCOME',
    emoji: '🪙',
    title: '第一桶金',
    rarity: 'silver',
    symbol: 'coins',
    description: '首次获得作品收益（V6 纪念）',
  },
] as const;

export type AchievementDictItem = (typeof ACHIEVEMENT_DICT)[number];

/** 数量型成就的判定阈值（metric → 档位）。触发点事件后调用对应 check 即可。 */
export const THRESHOLD_LADDER = {
  helped: [
    { key: 'HELP_10', n: 10 },
    { key: 'HELP_50', n: 50 },
    { key: 'HELP_100', n: 100 },
    { key: 'HELP_500', n: 500 },
    { key: 'HELP_1000', n: 1000 },
    { key: 'HELP_10000', n: 10000 },
  ],
  likes: [
    { key: 'LIKES_10', n: 10 },
    { key: 'LIKES_100', n: 100 },
    { key: 'LIKES_1000', n: 1000 },
  ],
  favs: [
    { key: 'FAVS_10', n: 10 },
    { key: 'FAVS_100', n: 100 },
  ],
  works: [
    { key: 'FIRST_WORK', n: 1 },
    { key: 'WORKS_10', n: 10 },
  ],
} as const;
