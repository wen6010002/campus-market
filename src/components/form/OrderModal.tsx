'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { toast } from '@/stores/ui';
import { useCreateOrder, useOrder } from '@/hooks/useOrder';
import type { WorkListItem } from '@/lib/types';
import type { PayMethod } from '@/lib/constants';

interface Props {
  open: boolean;
  work: WorkListItem;
  onClose: () => void;
  onSuccess: () => void;
}

/** 确认订单 + 支付方式 + 二维码收银台（对应原型 openPurchase） */
export function OrderModal({ open, work, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<PayMethod>('WECHAT');
  const [paying, setPaying] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const createOrder = useCreateOrder(work.id);
  const order = useOrder(activeOrderId);

  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // 轮询到已支付 → 成功
  useEffect(() => {
    if (order.data?.payStatus === 'PAID') {
      toast('支付成功，已获得下载权限', 'ok');
      closeRef.current();
      successRef.current();
    }
  }, [order.data?.payStatus]);

  async function submit() {
    setPaying(true);
    try {
      const { orderId, pay } = await createOrder.mutateAsync(method);
      if (pay.provider === 'mock') {
        toast('购买成功，已获得下载权限', 'ok');
        onClose();
        onSuccess();
      } else if (pay.provider === 'wechat') {
        const qrDataUrl = await QRCode.toDataURL(pay.codeUrl ?? '', { width: 220, margin: 1 });
        setQr(qrDataUrl);
        setActiveOrderId(orderId);
      } else if (pay.provider === 'alipay') {
        window.location.href = pay.redirectUrl;
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '下单失败', 'warn');
    } finally {
      setPaying(false);
    }
  }

  function back() {
    setQr(null);
    setActiveOrderId(null);
  }

  return (
    <Modal open={open} onClose={onClose} sm>
      <ModalHead title="确认订单" onClose={onClose} />
      {qr ? (
        <ModalBody>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <img
              src={qr}
              alt="微信支付二维码"
              style={{ width: 220, height: 220, margin: '0 auto' }}
            />
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 12 }}>
              微信扫码支付 ¥{work.price}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
              请使用微信扫一扫完成支付，支付成功后自动跳转
            </div>
          </div>
        </ModalBody>
      ) : (
        <ModalBody>
          <div
            className="card"
            style={{ background: 'var(--bg-soft)', padding: 14, marginBottom: 16 }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div
                className="dh-wcover"
                style={{
                  width: 40,
                  height: 40,
                  background: 'var(--bg-deep)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 6,
                }}
              >
                {work.coverIcon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b
                  style={{
                    fontSize: 13.5,
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {work.title}
                </b>
                <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                  {work.course} · {work.fileType}
                </span>
              </div>
            </div>
          </div>
          <div className="field">
            <label>支付方式</label>
            <div className="opt-list">
              <div
                className={`opt ${method === 'WECHAT' ? 'active' : ''}`}
                onClick={() => setMethod('WECHAT')}
              >
                <span className="opt-radio" />
                <div className="opt-main">
                  <b>微信支付</b>
                  <span>推荐</span>
                </div>
                <div className="opt-meta" style={{ fontSize: 20 }}>
                  💚
                </div>
              </div>
              <div
                className={`opt ${method === 'ALIPAY' ? 'active' : ''}`}
                onClick={() => setMethod('ALIPAY')}
              >
                <span className="opt-radio" />
                <div className="opt-main">
                  <b>支付宝</b>
                  <span>花呗 / 余额</span>
                </div>
                <div className="opt-meta" style={{ fontSize: 20 }}>
                  💙
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '12px 0',
              borderTop: '1px solid var(--line)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>实付金额</span>
            <span>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--fine)' }}>
                ¥{work.price}
              </span>
              {work.oldPrice ? (
                <small
                  style={{
                    color: 'var(--ink-faint)',
                    textDecoration: 'line-through',
                    marginLeft: 6,
                  }}
                >
                  ¥{work.oldPrice}
                </small>
              ) : null}
            </span>
          </div>
        </ModalBody>
      )}
      <ModalFoot>
        <button className="btn btn-ghost" onClick={qr ? back : onClose}>
          {qr ? '返回' : '取消'}
        </button>
        {!qr ? (
          <button className="btn btn-primary btn-lg" onClick={submit} disabled={paying}>
            {paying ? '支付中…' : `立即支付 ¥${work.price}`}
          </button>
        ) : null}
      </ModalFoot>
    </Modal>
  );
}
