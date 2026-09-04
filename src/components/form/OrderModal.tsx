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

/** 确认订单 + 支付（V6：仅支付宝，跳转码支付收银台；微信收款已下线） */
export function OrderModal({ open, work, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<PayMethod>('ALIPAY');
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
      } else if (pay.provider === 'alipay') {
        toast('正在跳转支付宝…', 'ok');
        window.location.href = pay.redirectUrl; // 支付完成后由 return_url 跳回 /pay/result
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
            <div className={`opt active`} onClick={() => setMethod('ALIPAY')}>
              <span className="opt-radio" />
              <div className="opt-main">
                <b>支付宝</b>
                <span>余额 / 花呗 / 银行卡</span>
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
