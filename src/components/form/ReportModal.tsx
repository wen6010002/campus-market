'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';
import { REPORT_REASONS } from '@/lib/constants';
import type { ReportTargetType } from '@/lib/constants';

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  /** 展示用目标描述（如作品标题） */
  targetLabel?: string;
}

/** 举报弹窗（V3-6）：原因单选 + 补充说明；同人同目标未结单幂等（后端 409） */
export function ReportModal({ open, onClose, targetType, targetId, targetLabel }: Props) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!reason) return toast('请选择举报原因', 'warn');
    setSubmitting(true);
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId, reason, detail: detail.trim() || undefined }),
      });
      toast('已收到举报，我们会尽快核实', 'ok');
      onClose();
      setReason('');
      setDetail('');
    } catch (e) {
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '提交失败', 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-md"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div className="modal-head">
          <b>举报{targetLabel ? `：${targetLabel.slice(0, 24)}` : ''}</b>
          <button className="modal-x" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 10 }}>
            举报原因 <span className="req">*</span>
          </label>
          <div className="rp-reasons">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`rp-reason ${reason === r.key ? 'active' : ''}`}
                onClick={() => setReason(r.key)}
              >
                <b>{r.label}</b>
                {r.desc !== '—' ? <small>{r.desc}</small> : null}
              </button>
            ))}
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>补充说明（选填）</label>
            <textarea
              className="textarea"
              rows={3}
              maxLength={600}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="补充具体情况，帮助我们更快核实"
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? '提交中…' : '提交举报'}
          </button>
        </div>
      </div>
    </div>
  );
}
