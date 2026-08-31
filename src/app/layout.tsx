import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Noto_Sans_SC } from 'next/font/google';
import { Providers } from './providers';
import '@/styles/globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const noto = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-noto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '课搭 — 大学生成长社区',
  description: '分享知识 → 帮助同学 → 获得影响力 → 获得收益',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${jakarta.variable} ${noto.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
