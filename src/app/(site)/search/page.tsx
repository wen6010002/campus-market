'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSearch } from '@/hooks/useSearch';
import { WorkCard } from '@/components/work/WorkCard';
import { CreatorCard } from '@/components/creator/CreatorCard';
import { Empty } from '@/components/common/Empty';

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="page">加载中…</main>}>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const sp = useSearchParams();
  const q = sp.get('q') ?? '';
  const [tab, setTab] = useState<'all' | 'works' | 'creators'>('all');
  const { data, isLoading } = useSearch(q);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>搜索{q ? `「${q}」` : ''}</h1>
          <div className="sub">{isLoading ? '搜索中…' : `共 ${data?.total ?? 0} 条结果`}</div>
        </div>
      </div>

      {q.trim() ? (
        <>
          <div className="tabs" style={{ marginBottom: 18 }}>
            <button
              className={`tab-btn ${tab === 'all' ? 'active' : ''}`}
              onClick={() => setTab('all')}
            >
              全部
            </button>
            <button
              className={`tab-btn ${tab === 'works' ? 'active' : ''}`}
              onClick={() => setTab('works')}
            >
              资料
            </button>
            <button
              className={`tab-btn ${tab === 'creators' ? 'active' : ''}`}
              onClick={() => setTab('creators')}
            >
              创作者
            </button>
          </div>

          {(tab === 'all' || tab === 'creators') && data?.creators.length ? (
            <div className="creators-grid" style={{ marginBottom: 24 }}>
              {data.creators.map((c) => (
                <CreatorCard key={c.id} creator={c} />
              ))}
            </div>
          ) : null}

          {(tab === 'all' || tab === 'works') && data?.works.length ? (
            <div className="card-grid">
              {data.works.map((w) => (
                <WorkCard key={w.id} work={w} />
              ))}
            </div>
          ) : null}

          {!isLoading && !data?.total ? (
            <Empty
              icon="🔍"
              title="没有找到相关内容"
              desc="换个关键词试试，或搜索课程名、创作者名、免费攻略"
            />
          ) : null}
        </>
      ) : (
        <Empty icon="🔍" title="输入关键词开始搜索" desc="搜索课程、创作者、免费攻略…" />
      )}
    </main>
  );
}
