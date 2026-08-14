'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePresign, useCreateWork, usePublishWork } from '@/hooks/useUpload';
import { uploadFile, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';
import type { FileType } from '@/lib/constants';

const TYPE_BY_EXT: Record<string, FileType> = {
  pdf: 'PDF',
  doc: 'DOC',
  docx: 'DOCX',
  ppt: 'PPT',
  pptx: 'PPTX',
  zip: 'ZIP',
  png: 'IMAGE',
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
};

function detectType(name: string): FileType {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return TYPE_BY_EXT[ext] ?? 'OTHER';
}

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    course: '',
    tags: '',
    isFree: true,
    isOriginal: true,
    price: '',
    copyright: false,
  });
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const presign = usePresign();
  const createWork = useCreateWork();
  const publishWork = usePublishWork();

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({
        ...f,
        [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
      }));

  async function calcSha(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function submit() {
    if (!file) return toast('请先上传文件', 'warn');
    if (!form.title || !form.description || !form.course) return toast('请填写作品信息', 'warn');
    if (!form.copyright) return toast('请勾选原创/授权声明', 'warn');
    if (!form.isFree && !form.price) return toast('请填写价格', 'warn');

    setSubmitting(true);
    try {
      const fileType = detectType(file.name);
      const fileSha = await calcSha(file);
      const { fileKey, putUrl } = await presign.mutateAsync({
        fileType,
        fileSize: file.size,
        sha: fileSha,
      });
      await uploadFile(putUrl, file, setProgress);
      const work = await createWork.mutateAsync({
        title: form.title,
        description: form.description,
        course: form.course,
        fileType,
        fileKey,
        fileSha,
        fileSize: file.size,
        isFree: form.isFree,
        price: form.isFree ? undefined : form.price,
        tags: form.tags
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
        previewToc: [],
        isOriginal: form.isOriginal,
        copyrightAccepted: form.copyright,
      });
      await publishWork.mutateAsync(work.id);
      toast('作品已提交审核，通过后将自动上架', 'ok');
      router.push('/creator-center?tab=works');
    } catch (e) {
      toast(e instanceof ApiError ? messageFor(e.code) : '发布失败', 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1>发布作品</h1>
          <div className="sub">分享你的知识，帮助同学，获得收益</div>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="field">
          <label>
            作品文件 <span className="req">*</span>
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />
          {file ? (
            <div className="hint" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              {file.name}（{(file.size / 1024 / 1024).toFixed(1)} MB）
            </div>
          ) : null}
        </div>
        <div className="field">
          <label>
            标题 <span className="req">*</span>
          </label>
          <input
            className="input"
            value={form.title}
            onChange={set('title')}
            placeholder="作品标题（≤120 字）"
          />
        </div>
        <div className="field">
          <label>
            简介 <span className="req">*</span>
          </label>
          <textarea
            className="textarea"
            value={form.description}
            onChange={set('description')}
            placeholder="介绍作品内容与亮点"
          />
        </div>
        <div className="field">
          <label>
            适用课程 <span className="req">*</span>
          </label>
          <input
            className="input"
            value={form.course}
            onChange={set('course')}
            placeholder="如：数据库原理"
          />
        </div>
        <div className="field">
          <label>标签（逗号分隔，≤5 个）</label>
          <input
            className="input"
            value={form.tags}
            onChange={set('tags')}
            placeholder="如：数据库,期末复习,免费"
          />
        </div>
        <div className="field">
          <label>定价</label>
          <div className="opt-list">
            <div
              className={`opt ${form.isFree ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, isFree: true }))}
            >
              <span className="opt-radio" />
              <div className="opt-main">
                <b>免费</b>
                <span>积累影响力</span>
              </div>
            </div>
            <div
              className={`opt ${!form.isFree ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, isFree: false }))}
            >
              <span className="opt-radio" />
              <div className="opt-main">
                <b>精品付费</b>
                <span>获得收益（抽成 10%）</span>
              </div>
            </div>
          </div>
          {!form.isFree ? (
            <input
              className="input"
              type="number"
              min="0.1"
              step="0.1"
              value={form.price}
              onChange={set('price')}
              placeholder="价格（元）"
              style={{ marginTop: 10 }}
            />
          ) : null}
        </div>
        <div className="field">
          <label>原创声明</label>
          <div className="opt-list">
            <div
              className={`opt ${form.isOriginal ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, isOriginal: true }))}
            >
              <span className="opt-radio" />
              <div className="opt-main">
                <b>原创</b>
                <span>我本人创作</span>
              </div>
            </div>
            <div
              className={`opt ${!form.isOriginal ? 'active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, isOriginal: false }))}
            >
              <span className="opt-radio" />
              <div className="opt-main">
                <b>整理 / 转载</b>
                <span>已获授权</span>
              </div>
            </div>
          </div>
        </div>
        <div className="field">
          <label
            className="check"
            style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}
          >
            <input type="checkbox" checked={form.copyright} onChange={set('copyright')} />
            <span>我确认拥有该作品的原创/合法授权，同意平台版权规范。</span>
          </label>
        </div>
        {submitting ? (
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '12px 0' }}>
            上传中 {progress}%
          </div>
        ) : null}
        <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={submitting}>
          {submitting ? '发布中…' : '提交审核'}
        </button>
      </div>
    </main>
  );
}
