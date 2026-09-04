'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useOrder } from '@/hooks/useOrder';
import { ApiError } from '@/lib/api/client';

/** 支付宝支付完成后的落地页（码支付 return_url）。轮询订单状态，PAID 后引导下载。 */
function PayResult() {
  const sp = useSearchParams();
  const orderId = sp.get('out_trade_no');
  const { data: order, isLoading, error } = useOrder(orderId);

  if (!orderId) {
    return (
      <Card icon="🧾" title="缺少订单号" desc="支付结果链接无效，可到「我的 → 订单」查看订单状态" />
    );
  }

  // 查询失败 = 终态：订单不存在（已被处理/清理）或当前浏览器不是买家登录态
  // （扫码付款的人和下单登录的浏览器往往不是同一个，比如同学代付）
  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    if (status === 401) {
      return (
        <Card
          icon="🔐"
          title="请登录后查看支付结果"
          desc="如已完成付款，用下单时的账号登录后再打开本页即可看到结果"
          actions={
            <Link
              className="btn btn-primary"
              href={`/login?from=${encodeURIComponent(`/pay/result?out_trade_no=${orderId}`)}`}
            >
              去登录
            </Link>
          }
        />
      );
    }
    return (
      <Card
        icon="🧾"
        title="订单不存在"
        desc="该订单可能已被处理或已失效；如已付款但未收到资料，请联系平台核实"
        actions={
          <Link className="btn btn-light" href="/">
            回首页
          </Link>
        }
      />
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
