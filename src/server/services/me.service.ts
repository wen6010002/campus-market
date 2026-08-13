import { prisma } from '../db';

export const meService = {
  /** 我的订单 */
  async orders(userId: string) {
    const orders = await prisma.order.findMany({
      where: { buyerId: userId },
      include: {
        work: {
          select: { id: true, title: true, course: true, coverIcon: true, coverTheme: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => ({
      id: o.id,
      workId: o.workId,
      work: o.work,
      amount: o.amount.toFixed(2),
      payStatus: o.payStatus,
      payMethod: o.payMethod,
      paidAt: o.paidAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
    }));
  },

  /** 我的资料（filter=all/bought/download/fav/rated） */
  async library(userId: string, filter: string) {
    const [orders, downloads, favs, ratings] = await Promise.all([
      prisma.order.findMany({
        where: { buyerId: userId, payStatus: 'PAID' },
        include: { work: true },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.download.findMany({
        where: { userId: userId },
        include: { work: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.favorite.findMany({
        where: { userId: userId },
        include: { work: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workRating.findMany({
        where: { userId: userId },
        include: { work: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = new Map<string, { work: any; kind: string; time: Date }>();
    const put = (work: any, kind: string, time: Date) => {
      if (work && !items.has(work.id)) items.set(work.id, { work, kind, time });
    };

    if (filter === 'all' || filter === 'bought')
      for (const o of orders) put(o.work, 'bought', o.paidAt!);
    if (filter === 'all' || filter === 'download')
      for (const d of downloads) put(d.work, 'download', d.createdAt);
    if (filter === 'all' || filter === 'fav') for (const f of favs) put(f.work, 'fav', f.createdAt);
    if (filter === 'all' || filter === 'rated')
      for (const r of ratings) put(r.work, 'rated', r.createdAt);

    return [...items.values()]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .map(({ work, kind, time }) => ({
        id: work.id,
        title: work.title,
        course: work.course,
        coverIcon: work.coverIcon,
        coverTheme: work.coverTheme,
        isFree: work.isFree,
        price: work.price.toFixed(2),
        kind,
        time: time.toISOString(),
      }));
  },

  /** 通知 */
  async notifications(userId: string) {
    const list = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return list.map((n) => ({
      id: n.id,
      type: n.type,
      text: n.text,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { ok: true };
  },
};
