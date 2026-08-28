import Link from 'next/link';

export function Footer() {
  return (
    <footer>
      <div className="foot-inner">
        <div className="foot-brand">
          <div className="logo">
            <div className="logo-mark">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 4.5C5 3.7 5.7 3 6.5 3h9c.8 0 1.5.7 1.5 1.5v14c0 .8-.7 1.5-1.5 1.5H10l-4 3.2c-.5.4-1.2.1-1.2-.5V4.5Z"
                  fill="#fff"
                />
                <path d="M9 9h6M9 12h4" stroke="#ED4E2D" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="logo-text">
              <b>Campus Market</b>
              <span>大学生成长社区</span>
            </div>
          </div>
          <p>不是资料下载站，而是大学生成长平台。让知识在校园里流动，让每个愿意分享的人被看见。</p>
          <div className="creed">&ldquo;让用户每天都想打开，而不是考试前才打开。&rdquo;</div>
        </div>
        <div className="foot-col">
          <h5>探索</h5>
          <Link href="/">校园广场</Link>
          <Link href="/following">关注动态</Link>
          <Link href="/search?q=路线">学习路线</Link>
          <Link href="/search?q=免费">免费攻略</Link>
        </div>
        <div className="foot-col">
          <h5>创作者</h5>
          <Link href="/upload">发布作品</Link>
          <Link href="/explore">分类浏览</Link>
          <Link href="/following">关注动态</Link>
          <Link href="/income">钱包提现</Link>
        </div>
        <div className="foot-col">
          <h5>关于</h5>
          <Link href="#">平台理念</Link>
          <Link href="#">校园认证</Link>
          <Link href="#">原创保护</Link>
          <Link href="#">联系我们</Link>
        </div>
      </div>
      <div className="foot-bottom">
        <span>© 2026 Campus Market · 知识在校园里流动</span>
        <div className="socials">
          <a>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5 7h-2c-.6 0-1 .5-1 1v2h3l-.5 3H14v6h-3v-6H9v-3h2V9.5C11 8 12 7 13.5 7H17v2Z" />
            </svg>
          </a>
          <a>
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M3 11c5-4 13-4 18 0M5 14c4-3 10-3 14 0M7 17c3-2 7-2 10 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </a>
          <a>
            <svg viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
