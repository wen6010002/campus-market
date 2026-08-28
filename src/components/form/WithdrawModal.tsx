'use client';

import { useState } from 'react';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { toast } from '@/stores/ui';
import { usePayout } from '@/hooks/useIncome';
import { ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import type { PayMethod } from '@/lib/constants';

interface Props {
  open: boolean;
  withdrawable: string;
  onClose: () => void;
  onSuccess: () => void;
}

/** 提现弹窗（校验 ≤ 可提现余额） */
export function WithdrawModal({ open, withdrawable, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('WECHAT');
  const [submitting, setSubmitting] = useState(false);
  const payout = usePayout();

  async function submit() {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast('请输入有效金额', 'warn');
      return;
    }
    if (n > Number(withdrawable)) {
      toast('提现金额不能超过可提现余额', 'warn');
      return;
    }
    setSubmitting(true);
    try {
      await payout.mutateAsync({ amount: n, method });
      toast('提现申请已提交，预计 1-3 个工作日到账', 'ok');
      onClose();
      onSuccess();
    } catch (e) {
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '提现失败', 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} sm>
      <ModalHead title="提现到微信" onClose={onClose} />
      <ModalBody>
        <div className="field">
          <label>提现金额（可提现 ¥{withdrawable}）</label>
          <input
            className="input"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="输入金额"
          />
        </div>
        <div className="field">
          <label>到账方式</label>
          <div className="opt-list">
            <div
              className={`opt ${method === 'WECHAT' ? 'active' : ''}`}
              onClick={() => setMethod('WECHAT')}
            >
              <span className="opt-radio" />
              <div className="opt-main">
                <b>微信零钱</b>
                <span>推荐</span>
              </div>
              <div className="opt-meta" style={{ fontSize: 20 }}>
                💚
              </div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          平台抽成 10% 已在入账时扣除，提现不额外收费。
        </div>
      </ModalBody>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? '提交中…' : '确认提现'}
        </button>
      </ModalFoot>
    </Modal>
  );
}
