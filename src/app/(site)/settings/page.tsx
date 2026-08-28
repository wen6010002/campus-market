'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch, uploadFile, ApiError } from '@/lib/api/client';
import { usePresign } from '@/hooks/useUpload';
import { messageFor } from '@/lib/api/errors';
import { toast } from '@/stores/ui';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/common/UserAvatar';

/** 资料编辑独立页（V3 调整：由个人主页弹窗改为整页，/settings） */
export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isLoading } = useAuth();
  const presign = usePresign();
  const [form, setForm] = useState({
    username: '',
    bio: '',
    college: '',
    grade: '',
    major: '',
  });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        bio: user.bio ?? '',
        college: user.student?.college ?? '',
        grade: user.student?.grade ?? '',
        major: user.student?.major ?? '',
      });
    }
  }, [user]);

  if (isLoading) return <main className="page">加载中…</main>;
  if (!user) return null;

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onAvatarFile(f: File | null) {
    if (!f || !user) return;
    if (f.size > 5 * 1024 * 1024) return toast('头像不能超过 5MB', 'warn');
    setAvatarUploading(true);
    try {
      const { fileKey, putUrl } = await presign.mutateAsync({
        kind: 'avatar',
        fileType: 'IMAGE',
        fileSize: f.size,
      });
      await uploadFile(putUrl, f);
      await apiFetch('/me/avatar', {
        method: 'POST',
        body: JSON.stringify({ avatarKey: fileKey }),
      });
      toast('头像已更新', 'ok');
      // 头像散布在作品作者/榜单/动态等所有查询里——全量失效一次（低频操作，可接受）
      qc.invalidateQueries();
    } catch (e) {
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '头像上传失败', 'warn');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function save() {
    if (!user) return;
    if (form.username.trim().length < 2) return toast('用户名至少 2 个字符', 'warn');
    setSaving(true);
    try {
      await apiFetch('/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          username: form.username.trim(),
          bio: form.bio.trim() || null,
          college: form.college.trim(),
          grade: form.grade.trim(),
          major: form.major.trim(),
        }),
      });
      toast('资料已保存', 'ok');
      qc.invalidateQueries();
      router.push(`/user/${user.id}`);
    } catch (e) {
      toast(e instanceof ApiError ? messageFor(e.code, e.message) : '保存失败', 'warn');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page" style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <h1>编辑资料</h1>
          <div className="sub">头像、用户名、简介与学籍信息</div>
        </div>
        <Link className="right btn btn-light btn-sm" href={`/user/${user.id}`}>
          ← 返回个人主页
        </Link>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="field">
          <label>头像</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <UserAvatar id={user.id} user={user} size={64} radius={14} />
            <div>
              <button
                className="btn btn-light"
                disabled={avatarUploading}
                onClick={() => document.getElementById('avatar-input')?.click()}
              >
                {avatarUploading ? '上传中…' : '上传头像图片'}
              </button>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>
                JPG / PNG / WebP，≤5MB；不上传则保留当前头像
              </div>
            </div>
            <input
              id="avatar-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => onAvatarFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <div className="field">
          <label>
            用户名 <span className="req">*</span>
          </label>
          <input
            className="input"
            value={form.username}
            onChange={set('username')}
            maxLength={30}
          />
          <div className="hint" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            2~30 字，保存时校验唯一性
          </div>
        </div>
        <div className="field">
          <label>个人简介</label>
          <textarea
            className="textarea"
            rows={3}
            value={form.bio}
            onChange={set('bio')}
            maxLength={200}
            placeholder="一句话介绍自己（≤200 字）"
          />
        </div>
        <div className="field">
          <label>学院</label>
          <input className="input" value={form.college} onChange={set('college')} maxLength={60} />
        </div>
        <div className="field">
          <label>年级</label>
          <input className="input" value={form.grade} onChange={set('grade')} maxLength={30} />
        </div>
        <div className="field">
          <label>专业</label>
          <input className="input" value={form.major} onChange={set('major')} maxLength={60} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Link className="btn btn-ghost" href={`/user/${user.id}`}>
            取消
          </Link>
          <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存资料'}
          </button>
        </div>
      </div>
    </main>
  );
}
