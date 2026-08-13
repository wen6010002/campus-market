import { Nav } from '@/components/chrome/Nav';
import { Footer } from '@/components/chrome/Footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  );
}
