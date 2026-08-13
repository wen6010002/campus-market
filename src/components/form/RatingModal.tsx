'use client';

import { useState } from 'react';
import { Modal, ModalHead, ModalBody, ModalFoot } from '@/components/common/Modal';
import { Stars } from '@/components/common/Stars';
import { toast } from '@/stores/ui';
import { useCreateRating, useRatingTags } from '@/hooks/useRatings';
import { ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';

interface Props {
  open: boolean;
  workId: string;
  workTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

const LABELS: Record<number, string> = {
  5: '力荐 · 5 星',
  4: '推荐 · 4 星',
  3: '还行 · 3 星',
  2: '较差 · 2 星',
  1: '很差 · 1 星',
};

/** 评分弹窗（对应原型 openRating：星级 + 文字 + pos/neg 标签多选） */
export function RatingModal({ open, workId, workTitle, onClose, onSuccess }: Props) {
  const [stars, setStars] = useState(5);
  const [hover, setHover] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { data: tags } = useRatingTags(workId);
  const createRating = useCreateRating(workId);

  function toggleTag(t: string) {
    setChosen((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));
  }

  async function submit() {
    if (text.trim().length < 5) {
      toast('评价至少 5 个字', 'warn');
      return;
    }
    setSubmitting(true);
    try {
      await createRating.mutateAsync({ stars, text: text.trim(), tags: chosen });
      toast('评价已提交，感谢你的反馈！', 'ok');
      onClose();
      onSuccess();
    } catch (e) {
      toast(e instanceof ApiError ? messageFor(e.code) : '提交失败', 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  const allTags = [...(tags?.pos ?? []), ...(tags?.neg ?? [])];
  const negTags = tags?.neg ?? [];

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHead title="评价这个作品" sub={workTitle} onClose={onClose} />
      <ModalBody>
        <div style={{ textAlign: 'center', padding: '6px 0 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Stars
              value={hover ?? stars}
              size="lg"
              clickable
              onChange={setStars}
              onHover={setHover}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
            {LABELS[stars]}
          </div>
        </div>
        <div className="field">
          <label>
            你的评价 <span className="req">*</span>
          </label>
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="说说这个作品哪里帮到了你，或者哪里可以更好…（至少 5 字）"
          />
        </div>
        <div className="field">
          <label>标签（可多选）</label>
          <div className="chips">
            {allTags.map((t) => (
              <span
                key={t}
                className={`chip ${negTags.includes(t) ? 'neg' : ''} ${chosen.includes(t) ? 'active' : ''}`}
                onClick={() => toggleTag(t)}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </ModalBody>
      <ModalFoot>
        <button className="btn btn-ghost" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? '提交中…' : '提交评价'}
        </button>
      </ModalFoot>
    </Modal>
  );
}
