import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Manifesto from '@/components/Manifesto';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <Manifesto />
      {/* Future sections: Services, Interactive3D, Showcase, FinalCTA */}
      <Footer />
    </>
  );
}
