'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePresign } from '@/hooks/useUpload';
import { Empty } from '@/components/common/Empty';
import { apiFetch, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { parseRoadmapMd, validateRoadmap } from '@/lib/roadmap/parse';
import { ROADMAP_CATEGORIES } from '@/lib/constants';
import { toast } from '@/stores/ui';
import type { WorkListItem } from '@/lib/types';

const FORMAT_DOC = `## 阶段一：环境与工具（第 1-2 周）
先把开发环境搭好，避免后面边学边补。
- [ ] 安装 JDK 17 与 IntelliJ IDEA
  社区版即可，学生邮箱可申请全家桶授权
- [ ] 完成 Java 基础语法（变量/流程控制/数组）
- [ ] 用 Maven 创建第一个项目

## 阶段二：…`;

type WorkPick = { id: string; title: string; coverIcon: string; isFree: boolean };

export default function RoadmapUploadPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [form, setForm] = useState({
    title: '',
    summary: '',
    category: 'BACKEND',
    coverIcon: '🗺',
  });
  const [mdText, setMdText] = useState('');
  const [mdFileKey, setMdFileKey] = useState('');
  const [mdFileName, setMdFileName] = useState('');
  const [credentialKey, setCredentialKey] = useState('');
  const [credentialName, setCredentialName] = useState('');
  const [experience, setExperience] = useState('');
  const [picked, setPicked] = useState<WorkPick[]>([]);
  const [workQuery, setWorkQuery] = useState('');

  const mdInputRef = useRef<HTMLInputElement>(null);
  const credInputRef = useRef<HTMLInputElement>(null);
  const presign = usePresign();

  // md 本地解析预览（与服务端同一解析器）
  const parsed = useMemo(() => (mdText ? parseRoadmapMd(mdText) : null), [mdText]);
  const parseError = parsed ? validateRoadmap(parsed) : null;
  const parsedPreview = parsed?.ok ? parsed : null;

  // 关联资料搜索（/search 返回 { works: WorkListItem[] }）
  const workSearch = useQuery({
    queryKey: ['roadmap', 'work-search', workQuery],
    queryFn: () =>
      apiFetch<{ works: WorkListItem[] }>(`/search?q=${encodeURIComponent(workQuery)}`),
    enabled: workQuery.trim().length >= 1,
  });

  const uploadText = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      setMdText(text);
      const { fileKey, putUrl } = await presign.mutateAsync({
        kind: 'roadmap',
        fileType: 'OTHER',
        fileSize: file.size,
      });
      const res = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        body: file,
      });
      if (!res.ok) throw new Error('md 上传失败');
      setMdFileKey(fileKey);
    },
    onError: (e) => toast(e instanceof Error ? e.message : '上传失败', 'warn'),
  });

  const uploadCredential = useMutation({
    mutationFn: async (file: File) => {
      const { fileKey, putUrl } = await presign.mutateAsync({
        kind: 'credential',
        fileType: 'IMAGE',
        fileSize: file.size,
      });
      const res = await fetch(putUrl, { method: 'PUT', body: file });
      if (!res.ok) throw new Error('学生证上传失败');
      setCredentialKey(fileKey);
    },
    onError: (e) => toast(e instanceof Error ? e.message : '上传失败', 'warn'),
  });

  const submit = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string; status: string; message: string }>('/roadmaps', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          summary: form.summary,
          category: form.category,
          coverIcon: form.coverIcon,
          mdSourceKey: mdFileKey,
          workIds: picked.map((w) => w.id),
          credentialKey: credentialKey || undefined,
          experience: experience || undefined,
        }),
      }),
    onSuccess: (r) => {
      toast(r.message, 'ok');
      router.push(`/roadmaps/${r.id}`);
    },
    onError: (e) =>
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '提交失败', 'warn'),
  });

  const canSubmit =
    form.title.trim() &&
    form.summary.trim() &&
    mdFileKey &&
    parsed?.ok &&
    !parseError &&
    (isAdmin || (credentialKey && experience.trim()));

  if (authLoading) return <main className="page">加载中…</main>;
  if (!user) {
    return (
      <main className="page">
        <Empty
          icon="🔒"
          title="请先登录"
          desc="上传学习路线图需要先登录"
          action={
            <Link className="btn btn-primary" href="/login?from=/roadmaps/upload">
              去登录
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="page" style={{ maxWidth: 980 }}>
      <div className="page-head">
        <div>
          <h1>上传学习路线图</h1>
          <div className="sub">
            {isAdmin
              ? '管理员上传 · 提交后直接发布'
              : '提交后进入人工审核 · 请附学生证与个人经历以提高采纳率'}
          </div>
        </div>
        <Link className="btn btn-light" href="/roadmaps">
          ← 路线图区
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>基本信息</h3>
        <div className="rm-form-grid">
          <label className="rm-field">
            <span>标题 *</span>
            <input
              className="input"
              maxLength={120}
              placeholder="如：新生到后端开发的学习路径"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="rm-field">
            <span>方向 *</span>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {ROADMAP_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rm-field">
            <span>封面图标</span>
            <input
              className="input"
              maxLength={8}
              value={form.coverIcon}
              onChange={(e) => setForm({ ...form, coverIcon: e.target.value })}
            />
          </label>
          <label className="rm-field wide">
            <span>简介 *</span>
            <input
              className="input"
              maxLength={500}
              placeholder="一句话说明这条路线适合谁、学到什么程度"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>路线图 md 文件 *</h3>
        <p className="rm-format-hint">
          格式约定：<code>## 标题</code> = 阶段；阶段下段落 = 阶段说明；<code>- [ ] 文本</code> = 步骤；步骤下一行缩进 = 步骤备注。至少 1 个阶段、3 个步骤。
        </p>
        <pre className="rm-format-demo">{FORMAT_DOC}</pre>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-light" onClick={() => mdInputRef.current?.click()}>
            选择 .md 文件
          </button>
          <input
            ref={mdInputRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setMdFileName(f.name);
                uploadText.mutate(f);
              }
            }}
          />
          {mdFileName ? <span style={{ fontSize: 14 }}>📄 {mdFileName}</span> : null}
          {uploadText.isPending ? <span style={{ color: 'var(--ink-soft)' }}>解析并上传中…</span> : null}
        </div>

        {parsed ? (
          parseError ? (
            <div className="rm-parse-error">✗ {parseError}</div>
          ) : parsedPreview ? (
            <div className="rm-parse-ok">
              ✓ 解析成功：{parsedPreview.content.phases.length} 个阶段 · {parsedPreview.stepsCount} 个步骤
              <div className="rm-parse-preview">
                {parsedPreview.content.phases.slice(0, 3).map((p, i) => (
                  <div key={i} className="rm-phase-mini">
                    <b>
                      {i + 1}. {p.title}
                    </b>
                    <ul>
                      {p.steps.slice(0, 3).map((s) => (
                        <li key={s.id}>{s.text}</li>
                      ))}
                      {p.steps.length > 3 ? <li>… 共 {p.steps.length} 步</li> : null}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>相关资料推荐（可选，最多 10 个）</h3>
        <p className="rm-format-hint">
          关联站内已上架的资料，展示在路线图末尾，学完路线可直接取用。
        </p>
        <input
          className="input"
          placeholder="搜索站内资料标题…"
          value={workQuery}
          onChange={(e) => setWorkQuery(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        {picked.length ? (
          <div className="rm-picked">
            {picked.map((w) => (
              <span key={w.id} className="chip tag active">
                {w.coverIcon} {w.title}
                <button onClick={() => setPicked(picked.filter((p) => p.id !== w.id))}>✕</button>
              </span>
            ))}
          </div>
        ) : null}
        {workSearch.data?.works.length ? (
          <div className="rm-work-results">
            {workSearch.data.works
              .filter((w) => !picked.some((p) => p.id === w.id))
              .map((w) => (
                <button
                  key={w.id}
                  className="rm-work-row"
                  onClick={() =>
                    picked.length < 10 && setPicked([...picked, { id: w.id, title: w.title, coverIcon: w.coverIcon, isFree: w.isFree }])
                  }
                >
                  <span>
                    {w.coverIcon} {w.title}
                  </span>
                  <small>{w.isFree ? '免费' : `¥${w.price}`}</small>
                </button>
              ))}
          </div>
        ) : workQuery ? (
          <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>没有匹配的资料</p>
        ) : null}
      </div>

      {!isAdmin ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>审核材料（必填）</h3>
          <p className="rm-format-hint">
            学生上传路线图需要人工审核，提交学生证照片与个人经历可帮助审核员核实你的专业背景，提高采纳率。材料仅审核可见。
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <button className="btn btn-light" onClick={() => credInputRef.current?.click()}>
              上传学生证照片
            </button>
            <input
              ref={credInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setCredentialName(f.name);
                  uploadCredential.mutate(f);
                }
              }}
            />
            {credentialName ? (
              <span style={{ fontSize: 14 }}>
                🪪 {credentialName} {uploadCredential.isPending ? '（上传中…）' : '✓'}
              </span>
            ) : null}
          </div>
          <textarea
            className="input"
            rows={4}
            maxLength={500}
            placeholder="个人经历：如「计算机科学与技术大二，已自学 Java 一年，做过两个课设项目，希望把学习路径分享给学弟学妹」"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
          />
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-lg"
          disabled={!canSubmit || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? '提交中…' : isAdmin ? '直接发布' : '提交审核'}
        </button>
        {!canSubmit && !submit.isPending ? (
          <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
            请完整填写基本信息、上传 md 并通过解析校验
            {!isAdmin ? '，并提交审核材料' : ''}
          </span>
        ) : null}
      </div>
    </main>
  );
}
