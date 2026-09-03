'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOrder } from '@/hooks/useOrder';

/** 支付宝支付完成后的落地页（码支付 return_url）。轮询订单状态，PAID 后引导下载。 */
function PayResult() {
  const sp = useSearchParams();
  const orderId = sp.get('out_trade_no');
  const { data: order, isLoading } = useOrder(orderId);

  if (!orderId) {
    return (
      <Card icon="🧾" title="缺少订单号" desc="支付结果链接无效，可到「我的 → 订单」查看订单状态" />
    );
  }

  if (isLoading || !order) {
    return <Card icon="⏳" title="正在查询支付结果…" desc={`订单号 ${orderId}`} />;
  }

  if (order.payStatus === 'PAID') {
    return (
      <Card
        icon="✅"
        title="支付成功"
        desc="已获得下载权限，可以开始学习啦"
        actions={
          <Link className="btn btn-primary btn-lg" href={`/work/${order.workId}`}>
            去下载资料
          </Link>
        }
      />
    );
  }

  if (order.payStatus === 'CLOSED') {
    return (
      <Card
        icon="🚫"
        title="订单已关闭"
        desc="订单超时未支付已自动关闭，未扣款；如需购买请重新下单"
        actions={
          <Link className="btn btn-primary" href={`/work/${order.workId}`}>
            重新购买
          </Link>
        }
      />
    );
  }

  // PENDING：return_url 先于异步通知到达是正常现象，2s 轮询会自动转成功
  return (
    <Card
      icon="⏳"
      title="支付确认中…"
      desc="如已付款请稍候，通常几秒内自动到账；确认后本页自动跳转"
      actions={
        <Link className="btn btn-light" href={`/work/${order.workId}`}>
          暂不等待，回资料页
        </Link>
      }
    />
  );
}

function Card({
  icon,
  title,
  desc,
  actions,
}: {
  icon: string;
  title: string;
  desc: string;
  actions?: React.ReactNode;
}) {
  return (
    <main
      className="page auth-page"
      style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}
    >
      <div
        className="card"
        style={{ width: 400, maxWidth: '100%', padding: 32, textAlign: 'center' }}
      >
        <div style={{ fontSize: 44, marginBottom: 8 }}>{icon}</div>
        <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>{title}</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>{desc}</div>
        {actions ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>{actions}</div>
        ) : null}
      </div>
    </main>
  );
}

export default function PayResultPage() {
  return (
    <Suspense fallback={<main className="page">加载中…</main>}>
      <PayResult />
    </Suspense>
  );
}
