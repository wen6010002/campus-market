'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePresign, useCreateWork, usePublishWork } from '@/hooks/useUpload';
import { uploadFile, ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';
import { CATEGORIES, PRESET_TAGS, FREE_MODE } from '@/lib/constants';
import type { FileType, CategoryKey } from '@/lib/constants';

/** 封面图标库（学科/用途向）与主题色板（对应 globals.css g-* 类） */
const COVER_ICONS = [
  '📄',
  '📖',
  '📘',
  '📚',
  '🗄️',
  '💻',
  '🌐',
  '🧠',
  '🗺️',
  '📐',
  '⚡',
  '🤖',
  '🏫',
  '🎓',
  '🧗',
  '💼',
  '🌱',
  '✏️',
  '🔬',
  '🎨',
  '🎵',
  '⚖️',
  '💰',
  '☕',
];
const COVER_THEMES = [
  'g-default',
  'g-db',
  'g-ai',
  'g-ds',
  'g-cet',
  'g-math',
  'g-os',
  'g-net',
  'g-ml',
  'g-java',
  'g-408',
  'g-line',
  'g-prob',
];
const CAT_DEFAULT_ICON: Record<CategoryKey, string> = {
  COURSE: '📖',
  EXAM: '🧗',
  ABROAD: '✈️',
  CAREER: '💼',
  TUTOR: '📐',
  LIFE: '🌱',
  CAMPUS: '🏫',
};

/** pdfjs 渲染 PDF 第 1 页为封面图（宽 600px 逻辑分辨率 × 2 清晰度，JPEG 85） */
async function renderPdfCover(file: File): Promise<Blob> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (600 / base.width) * 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 不可用');
  await page.render({ canvas, viewport }).promise;
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('封面生成失败'))), 'image/jpeg', 0.85),
  );
}

/** pdf-lib 截取 PDF 前 5 页生成试读副本（付费作品预览用，V3-4） */
async function makePreviewSample(file: File): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const src = await PDFDocument.load(await file.arrayBuffer());
  const out = await PDFDocument.create();
  const n = Math.min(5, src.getPageCount());
  const pages = await out.copyPages(
    src,
    Array.from({ length: n }, (_, i) => i),
  );
  for (const p of pages) out.addPage(p);
  const bytes = await out.save();
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
}

/** 付费 md 生成试读副本：截前 min(30%, 3000) 字符（行边界对齐）+ 尾注，配套服务端 10MB 上限 */
function makeMdSample(file: File): Promise<Blob> {
  return file.text().then((text) => {
    const cut = Math.min(Math.floor(text.length * 0.3), 3000);
    let body = text.slice(0, cut);
    const nl = body.lastIndexOf('\n');
    if (nl > 0) body = body.slice(0, nl); // 行边界截断，避免半行残句
    return new Blob([`${body}\n\n---\n\n> 📖 试读到此处，购买后解锁完整内容\n`], {
      type: 'text/markdown; charset=utf-8',
    });
  });
}

const TYPE_BY_EXT: Record<string, FileType> = {
  pdf: 'PDF',
  md: 'MD',
  markdown: 'MD',
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
  const [nonPdfAck, setNonPdfAck] = useState(false);
  const [category, setCategory] = useState<CategoryKey | ''>('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    course: '',
    isFree: true,
    isOriginal: true,
    price: '',
    copyright: false,
  });
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // 封面（V3-3）
  const [coverSource, setCoverSource] = useState<'auto' | 'icon' | 'custom'>('icon');
  const [autoCover, setAutoCover] = useState<{ blob: Blob; url: string } | null>(null);
  const [customCover, setCustomCover] = useState<{ file: File; url: string } | null>(null);
  const [iconPicked, setIconPicked] = useState('📄');
  const [themePicked, setThemePicked] = useState('g-default');
  const [coverRendering, setCoverRendering] = useState(false);
  const presign = usePresign();
  const createWork = useCreateWork();
  const publishWork = usePublishWork();

  const isPdf = file?.name.toLowerCase().endsWith('.pdf') ?? null; // 封面「自动截 PDF 首页」用
  const isPreviewable = file
    ? ['pdf', 'md', 'markdown'].some((e) => file.name.toLowerCase().endsWith(`.${e}`))
    : null;
  const presetTags = useMemo(
    () => (category ? PRESET_TAGS[category as CategoryKey] : []),
    [category],
  );

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({
        ...f,
        [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value,
      }));

  function toggleTag(name: string) {
    setTags((ts) => {
      if (ts.includes(name)) return ts.filter((t) => t !== name);
      if (ts.length >= 5) {
        toast('最多选择 5 个标签', 'warn');
        return ts;
      }
      return [...ts, name];
    });
  }

  function addCustomTag() {
    const t = customTag.trim();
    if (!t) return;
    if (tags.includes(t)) return setCustomTag('');
    if (tags.length >= 5) return toast('最多选择 5 个标签', 'warn');
    setTags((ts) => [...ts, t]);
    setCustomTag('');
  }

  /** 选择文件后：PDF 异步渲染第 1 页为自动封面；非 PDF 切图标配色模式 */
  async function handleFileForCover(f: File | null) {
    if (!f) return;
    if (f.name.toLowerCase().endsWith('.pdf')) {
      setCoverRendering(true);
      try {
        const blob = await renderPdfCover(f);
        setAutoCover({ blob, url: URL.createObjectURL(blob) });
        setCoverSource('auto');
      } catch {
        toast('自动封面生成失败，可改用图标配色或自定义封面', 'warn');
        setAutoCover(null);
        setCoverSource('icon');
      } finally {
        setCoverRendering(false);
      }
    } else {
      setAutoCover(null);
      setCoverSource('icon');
    }
  }

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
    if (!category) return toast('请选择用途大类', 'warn');
    if (!form.copyright) return toast('请勾选原创/授权声明', 'warn');
    // V7 全站免费：免费模式下提交恒为免费作品
    const submitFree = FREE_MODE || form.isFree;
    if (!submitFree && !form.price) return toast('请填写价格', 'warn');
    if (isPreviewable === false && !nonPdfAck)
      return toast('请先勾选「了解该格式无法在线预览」', 'warn');

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
      // 封面上传（V3-3）：自动缩略 / 自定义图 → covers/；图标配色 → coverIcon+coverTheme
      let coverKey: string | undefined;
      let coverIcon: string | undefined;
      let coverTheme: string | undefined;
      const coverBlob =
        coverSource === 'auto'
          ? autoCover?.blob
          : coverSource === 'custom'
            ? customCover?.file
            : null;
      if (coverBlob) {
        const { fileKey: ck, putUrl: cp } = await presign.mutateAsync({
          kind: 'cover',
          fileType: 'IMAGE',
          fileSize: coverBlob.size,
        });
        await uploadFile(cp, coverBlob);
        coverKey = ck;
      } else {
        coverIcon = iconPicked;
        coverTheme = themePicked;
      }
      // 付费作品生成试读副本（V3-4）：PDF 截前 5 页 / MD 截前 30%，预览端点只对未购者签该副本
      let previewKey: string | undefined;
      if ((fileType === 'PDF' || fileType === 'MD') && !submitFree) {
        try {
          const sample =
            fileType === 'PDF' ? await makePreviewSample(file) : await makeMdSample(file);
          const { fileKey: pk, putUrl: pp } = await presign.mutateAsync({
            kind: 'preview',
            fileType,
            fileSize: sample.size,
          });
          await uploadFile(pp, sample);
          previewKey = pk;
        } catch {
          // 试读副本失败不阻塞发布：该作品将无在线预览
        }
      }
      const work = await createWork.mutateAsync({
        title: form.title,
        description: form.description,
        course: form.course,
        fileType,
        fileKey,
        fileSha,
        fileSize: file.size,
        coverKey,
        previewKey,
        coverIcon,
        coverTheme,
        category: category as CategoryKey,
        isFree: submitFree,
        price: submitFree ? undefined : form.price,
        tags,
        previewToc: [],
        isOriginal: form.isOriginal,
        copyrightAccepted: form.copyright,
      });
      await publishWork.mutateAsync(work.id);
      toast('作品已提交审核，通过后将自动上架', 'ok');
      router.push('/me?tab=works');
    } catch (e) {
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '发布失败', 'warn');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div>
          <h1>发布作品</h1>
          <div className="sub">分享你的知识，帮助同学，共同成长</div>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="field">
          <label>
            作品文件 <span className="req">*</span>
          </label>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setNonPdfAck(false);
              handleFileForCover(f);
            }}
            style={{ fontSize: 13 }}
          />
          {file ? (
            <>
              <div className="hint" style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                {file.name}（{(file.size / 1024 / 1024).toFixed(1)} MB）
              </div>
              {isPreviewable ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: '9px 12px',
                    fontSize: 12.5,
                    borderRadius: 8,
                    background: 'var(--mint-50)',
                    color: '#047857',
                  }}
                >
                  {isPdf
                    ? '✓ PDF 可在线预览，推荐 — 浏览的同学无需下载即可翻阅全文'
                    : '✓ Markdown 可在线预览 — 标题、代码块、表格都会带排版渲染展示'}
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 8,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    borderRadius: 8,
                    background: 'var(--warn-50)',
                    color: '#92400e',
                  }}
                >
                  <b style={{ display: 'block', marginBottom: 2 }}>⚠️ 该格式不支持在线预览</b>
                  PDF 格式的资料可以在站内直接翻阅，获得更多观看量 —— 建议用 Word / PPT 的「导出为
                  PDF」功能转换后再上传。
                  <label
                    className="check"
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      cursor: 'pointer',
                      marginTop: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={nonPdfAck}
                      onChange={(e) => setNonPdfAck(e.target.checked)}
                    />
                    <span>我了解该格式无法在线预览，仍要上传</span>
                  </label>
                </div>
              )}
            </>
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
            placeholder="学科或课程名，如：高等数学 / 大学英语 / 数据库原理"
          />
        </div>
        <div className="field">
          <label>
            用途大类 <span className="req">*</span>
          </label>
          <div className="cat-list">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`cat-opt ${category === c.key ? 'active' : ''}`}
                onClick={() => {
                  setCategory(c.key);
                  setTags([]);
                  setIconPicked(CAT_DEFAULT_ICON[c.key as CategoryKey]);
                }}
              >
                <span className="c-ico">{c.icon}</span>
                <span className="c-main">
                  <b>{c.label}</b>
                  <small>{c.desc}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>标签（{category ? '选择或自填，合计 ≤5 个' : '请先选择用途大类'}）</label>
          {category ? (
            <>
              <div className="chips">
                {presetTags.map((t) => (
                  <span
                    key={t}
                    className={`chip ${tags.includes(t) ? 'active' : ''}`}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  placeholder="自定义标签（回车添加，仅 1 个）"
                />
                <button type="button" className="btn btn-light" onClick={addCustomTag}>
                  添加
                </button>
              </div>
              {tags.length ? (
                <div className="chips" style={{ marginTop: 10 }}>
                  {tags.map((t) => (
                    <span key={t} className="chip tag" onClick={() => toggleTag(t)}>
                      {t} ✕
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="hint" style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
              选择大类后展示对应标签
            </div>
          )}
        </div>
        <div className="field">
          <label>定价</label>
          {FREE_MODE ? (
            <div
              className="hint"
              style={{
                fontSize: 12.5,
                color: 'var(--ink-soft)',
                background: 'var(--mint-50, #f0faf6)',
                padding: '10px 12px',
                borderRadius: 10,
              }}
            >
              🎁 付费功能暂停中，当前全部作品免费开放；你的定价会保留，功能恢复后自动生效
            </div>
          ) : (
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
          )}
          {!FREE_MODE && !form.isFree ? (
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
          <label>封面</label>
          <div className="cover-mode-row">
            {isPdf ? (
              <button
                type="button"
                className={`cm-btn ${coverSource === 'auto' ? 'active' : ''}`}
                onClick={() => autoCover && setCoverSource('auto')}
                disabled={!autoCover}
              >
                {coverRendering ? '生成中…' : '自动封面（PDF 第 1 页）'}
              </button>
            ) : null}
            <button
              type="button"
              className={`cm-btn ${coverSource === 'icon' ? 'active' : ''}`}
              onClick={() => setCoverSource('icon')}
            >
              图标 + 配色
            </button>
            <button
              type="button"
              className={`cm-btn ${coverSource === 'custom' ? 'active' : ''}`}
              onClick={() => setCoverSource('custom')}
            >
              上传自定义封面
            </button>
          </div>

          {coverSource === 'auto' ? (
            <div className="cover-preview-box">
              {autoCover ? (
                <>
                  <img src={autoCover.url} alt="自动封面预览" className="cover-preview-img" />
                  <div className="cover-preview-note">已自动截取 PDF 第 1 页作为封面</div>
                </>
              ) : (
                <div className="cover-preview-note">
                  {coverRendering ? '正在渲染 PDF 第 1 页…' : '自动封面生成失败，请换一种方式'}
                </div>
              )}
            </div>
          ) : null}

          {coverSource === 'icon' ? (
            <div className="cover-icon-picker">
              <div className="cip-grid">
                {COVER_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    className={`cip-ic ${iconPicked === ic ? 'active' : ''}`}
                    onClick={() => setIconPicked(ic)}
                  >
                    {ic}
                  </button>
                ))}
              </div>
              <div className="cip-themes">
                {COVER_THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`cip-theme ${t} ${themePicked === t ? 'active' : ''}`}
                    onClick={() => setThemePicked(t)}
                    aria-label={t}
                  />
                ))}
              </div>
              <div className={`cover-sample ${themePicked}`}>
                <div className="glyph">{iconPicked}</div>
              </div>
            </div>
          ) : null}

          {coverSource === 'custom' ? (
            <div className="cover-preview-box">
              {customCover ? (
                <>
                  <img src={customCover.url} alt="自定义封面预览" className="cover-preview-img" />
                  <div className="cover-preview-note">
                    {customCover.file.name}（{(customCover.file.size / 1024).toFixed(0)} KB）
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      style={{ marginLeft: 10 }}
                      onClick={() => document.getElementById('custom-cover-input')?.click()}
                    >
                      重选图片
                    </button>
                  </div>
                </>
              ) : (
                <div className="cover-preview-note">
                  建议尺寸 600×800，JPG/PNG，≤5MB
                  <button
                    type="button"
                    className="btn btn-light btn-sm"
                    style={{ marginLeft: 10 }}
                    onClick={() => document.getElementById('custom-cover-input')?.click()}
                  >
                    选择图片
                  </button>
                </div>
              )}
              <input
                id="custom-cover-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) return toast('封面图片不能超过 5MB', 'warn');
                  setCustomCover({ file: f, url: URL.createObjectURL(f) });
                }}
              />
            </div>
          ) : null}
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
