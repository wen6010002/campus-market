import { Nav } from '@/components/chrome/Nav';
import { Footer } from '@/components/chrome/Footer';
import { MobileNav } from '@/components/chrome/MobileNav';
import { AnnounceGate } from '@/components/announce/AnnounceGate';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
      <MobileNav />
      <AnnounceGate />
    </>
  );
}
