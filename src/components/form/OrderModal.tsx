'use client';

import { useState } from 'react';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { toast } from '@/stores/ui';
import { useCreateOrder } from '@/hooks/useOrder';
import type { WorkListItem } from '@/lib/types';
import type { PayMethod } from '@/lib/constants';

interface Props {
  open: boolean;
  work: WorkListItem;
  onClose: () => void;
  onSuccess: () => void;
}

/** 确认订单 + 支付方式（对应原型 openPurchase） */
export function OrderModal({ open, work, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<PayMethod>('WECHAT');
  const [paying, setPaying] = useState(false);
  const createOrder = useCreateOrder(work.id);

  async function submit() {
    setPaying(true);
    try {
      const { pay } = await createOrder.mutateAsync(method);
      if (pay.provider === 'mock') {
        toast('购买成功，已获得下载权限', 'ok');
        onClose();
        onSuccess();
      } else if (pay.provider === 'wechat') {
        toast('请使用微信扫码支付', 'info');
        // 生产：渲染 codeUrl 二维码；此处占位
      } else if (pay.provider === 'alipay') {
        window.location.href = pay.redirectUrl;
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '下单失败', 'warn');
    } finally {
      setPaying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} sm>
      <ModalHead title="确认订单" onClose={onClose} />
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
                style={{ color: 'var(--ink-faint)', textDecoration: 'line-through', marginLeft: 6 }}
              >
                ¥{work.oldPrice}
              </small>
            ) : null}
          </span>
        </div>
      </ModalBody>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-primary btn-lg" onClick={submit} disabled={paying}>
          {paying ? '支付中…' : `立即支付 ¥${work.price}`}
        </button>
      </ModalFoot>
    </Modal>
  );
}
