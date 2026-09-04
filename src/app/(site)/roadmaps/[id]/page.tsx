'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRoadmap, useRoadmapCheck, useRoadmapFavorite, useRoadmapProgress } from '@/hooks/useRoadmaps';
import { Heatmap } from '@/components/roadmap/Heatmap';
import { CheckinCalendar } from '@/components/roadmap/CheckinCalendar';
import { WorkCard } from '@/components/work/WorkCard';
import { FineCard } from '@/components/work/FineCard';
import { ROADMAP_CATEGORY_LABEL } from '@/lib/constants';

export default function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const detail = useRoadmap(id);
  const progress = useRoadmapProgress(id, !!user);
  const check = useRoadmapCheck(id);
  const favorite = useRoadmapFavorite(id);

  const r = detail.data;
  const checkedSet = new Set(progress.data?.checked.map((c) => c.stepId) ?? []);

  const onToggle = (stepId: string, next: boolean) => {
    if (!user) {
      router.push(`/login?from=/roadmaps/${id}`);
      return;
    }
    check.mutate({ stepId, checked: next });
  };

  if (detail.isLoading) return <main className="page">加载中…</main>;
  if (detail.error || !r) {
    return (
      <main className="page">
        <div className="card">路线图不存在或未上架</div>
      </main>
    );
  }

  const totalSteps = r.stepsCount;
  const doneSteps = user ? (progress.data?.totalChecked ?? 0) : 0;
  const pct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>
            {r.coverIcon} {r.title}
            {r.uploader.role === 'ADMIN' ? <span className="rm-official" style={{ marginLeft: 10 }}>官方</span> : null}
          </h1>
          <div className="sub">
            {ROADMAP_CATEGORY_LABEL[r.category]} · {totalSteps} 步 · ♥ {r.favs} · 由{' '}
            <Link href={`/user/${r.uploader.id}`} style={{ color: 'var(--pri-600)' }}>
              {r.uploader.username}
            </Link>{' '}
            {r.uploader.role === 'ADMIN' ? '发布' : '上传'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-light" href="/roadmaps">
            ← 全部路线图
          </Link>
          <button
            className={`btn btn-sm ${r.myFav ? 'btn-light' : 'btn-primary'}`}
            onClick={() => {
              if (!user) {
                router.push(`/login?from=/roadmaps/${id}`);
                return;
              }
              favorite.mutate(!r.myFav);
            }}
          >
            {r.myFav ? '♥ 已收藏' : '♡ 收藏'}
          </button>
        </div>
      </div>

      {r.status !== 'PUBLISHED' ? (
        <div className={`rm-status-banner ${r.status}`}>
          {r.status === 'PENDING'
            ? '⏳ 该路线图正在审核中，仅你自己与管理员可见'
            : r.status === 'REJECTED'
              ? `❌ 未通过审核${r.rejectedReason ? `：${r.rejectedReason}` : ''}（可重新上传）`
              : r.status}
        </div>
      ) : null}

      <div className="rm-detail">
        <div className="rm-main">
          {r.summary ? <p className="rm-summary">{r.summary}</p> : null}

          <div className="rm-phases">
            {r.content.phases.map((phase, pi) => (
              <section key={pi} className="rm-phase">
                <header className="rm-phase-head">
                  <span className="rm-phase-no">{pi + 1}</span>
                  <div>
                    <h2>{phase.title}</h2>
                    {phase.desc ? <p>{phase.desc}</p> : null}
                  </div>
                </header>
                <ul className="rm-steps">
                  {phase.steps.map((step) => {
                    const done = checkedSet.has(step.id);
                    return (
                      <li key={step.id} className={`rm-step ${done ? 'done' : ''}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={(e) => onToggle(step.id, e.target.checked)}
                          />
                          <span className="rm-step-text">
                            {step.text}
                            {step.note ? <small>{step.note}</small> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          {r.works.length ? (
            <section className="rm-works">
              <h2 style={{ fontSize: 17, marginBottom: 12 }}>📚 相关资料推荐</h2>
              <div className="card-grid">
                {r.works.map((w) => (w.isFree ? <WorkCard key={w.id} work={w} /> : <FineCard key={w.id} work={w} />))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="rm-side">
          <div className="rm-side-card">
            <h3>我的进度</h3>
            {user ? (
              <>
                <div className="rm-progress-row">
                  <b>
                    {doneSteps} / {totalSteps} 步
                  </b>
                  <span>{pct}%</span>
                </div>
                <div className="rm-progress-bar">
                  <div className="rm-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="rm-streak">
                  🔥 连续打卡 <b>{progress.data?.streakDays ?? 0}</b> 天
                </div>
                <Heatmap byDay={progress.data?.byDay ?? {}} />
                <CheckinCalendar byDay={progress.data?.byDay ?? {}} />
                <p className="rm-side-tip">勾选左侧步骤即算当日打卡，热力图按当日完成步数着色。</p>
              </>
            ) : (
              <>
                <p className="rm-side-tip">登录后可勾选步骤打卡，沉淀你的学习热力图。</p>
                <Link className="btn btn-primary btn-block" href={`/login?from=/roadmaps/${id}`}>
                  登录并开始打卡
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
